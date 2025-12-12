import {
  BadRequestError,
  encryptPassword,
  generateToken,
  logger,
  ServerError,
  UnAuthorizError,
  validatePassword,
} from "@repo/common";
import "tsyringe";
import { autoInjectable } from "tsyringe";
import Redis, { IRedis } from "../configs/redis.config";
import ServerConfigs from "../configs/server.config";
import { IGoogleResponse } from "../interfaces/user.interface";
import AuthRepository from "../repositories/auth.repository";
import { KAFKA_EVENTS } from "../types";
import { handleGoogleAuth } from "../utils/google-config";
import { publishUserEvent } from "../utils/kafka";
import { sendOtpUtil, verifyOtpUtil } from "../utils/otp";
import { validateReferralCode } from "../utils/referral-validator";
import { sendResetLinkMail } from "../utils/smtp";
import { generateOTPUtil, generateUUID } from "../utils/utils";

@autoInjectable()
export default class Service {
  private redis: IRedis;

  constructor(private readonly userRepository: AuthRepository) {
    this.redis = Redis;
  }

  public async fetchTestData() {
    const result = await this.userRepository.getTestData();
    return result;
  }

  public async generateOtp(phoneNumber: string): Promise<any> {
    const userExist =
      await this.userRepository.userWithPhoneExistRepo(phoneNumber);
    
    // Special test account for Google/App Store - always use OTP 1234
    const isTestAccount = phoneNumber === "+918889689990" || phoneNumber === "918889689990";
    const otpCode: string = isTestAccount ? "1234" : generateOTPUtil();
    logger.info(`OTP Code : ${otpCode}`);

    // if (ServerConfigs.NODE_ENV === "development") {
      // Skip MSG91 for test account
      if (!isTestAccount) {
        const res = await sendOtpUtil(phoneNumber);
      }
    // }
    if (userExist) {
      const updateOtp = await this.userRepository.updateRecentOtp({
        phoneNumber,
        otpCode,
      });
      logger.warn(`Update OTP: ${updateOtp}`);

      return {
        data: {
          userId: userExist.userId,
        },
        message: "otp sent successfully",
      };
    } else {
      const userId = generateUUID();
      const createUser = await this.userRepository.createAuthUserWithPhone({
        phoneNumber,
        userId,
        provider: "local",
      });

      const updateOtp = await this.userRepository.updateRecentOtp({
        phoneNumber,
        otpCode,
      });

      logger.warn(`updated OTP: ${updateOtp}`);
      // SEND OTP HERE
      return {
        data: {
          userId: createUser.userId,
        },
        message: "otp sent successfully",
      };
    }
  }

  public async verifyOtp(phoneNumber: string, otpCode: string, referralCode?: string): Promise<any> {
    try {
      // Validate referral code if provided
      if (referralCode) {
        const isValid = await validateReferralCode(referralCode);
        if (!isValid) {
          throw new BadRequestError("Invalid referral code");
        }
        logger.debug(`Referral code validated: ${referralCode}`);
      }

      let verifiedUser;
      
      // Special test account for Google/App Store - always accept OTP 1234
      const isTestAccount = phoneNumber === "+918889689990" || phoneNumber === "918889689990";

      // if (ServerConfigs.NODE_ENV === "development") {
        if (isTestAccount) {
          // For test account, verify OTP is 1234
          if (otpCode !== "1234") {
            throw new BadRequestError("Invalid OTP for test account");
          }
          logger.info(`Test account OTP verified: ${phoneNumber}`);
        } else {
          // Normal flow - verify via MSG91
          const response = await verifyOtpUtil(phoneNumber, otpCode);
          if (response?.type === "error") {
            throw new BadRequestError(response?.message);
          }
        }

        verifiedUser =
          await this.userRepository.userWithPhoneExistRepo(phoneNumber);
      // } else {
      //   verifiedUser = await this.userRepository.verifyOtpRepo({
      //     phoneNumber,
      //     otpCode,
      //   });
      // }

      if (!verifiedUser) {
        throw new BadRequestError("invalid or expired OTP");
      }

      await this.userRepository.clearOtpAndMarkLoginRepo({
        phoneNumber,
        lastLoginAt: new Date(),
      });

      verifiedUser.password = null;
      verifiedUser.otpCode = null;

      if (!verifiedUser.onboarded) {
        // create user inside user-service with optional referral code
        await publishUserEvent(KAFKA_EVENTS.USER_SIGNUP, {
          userId: verifiedUser.userId,
          authId: verifiedUser.id,
          phoneNumber: phoneNumber,
          referralCode: referralCode || null,
        });
        logger.debug(`signup event published${referralCode ? ` with referral code: ${referralCode}` : ''}`);
      } else {
        logger.warn("user is already onboarded");
      }

      const token = generateToken(
        {
          session_id: `${verifiedUser.id}:${verifiedUser.userId}:${verifiedUser.phoneNumber}`,
        },
        ServerConfigs.TOKEN_SECRET
      );

      return {
        data: verifiedUser,
        token: token,
        message: "OTP verification successful",
      };
    } catch (error: any) {
      throw new ServerError(error?.message);
    }
  }

  public async loginWithPass(email: string, password: string): Promise<any> {
    const user = await this.userRepository.userExistWithEmail(email);

    if (!user) {
      throw new UnAuthorizError();
    }

    const userPass = user?.password;
    const isValidPassword = validatePassword(password, userPass);

    if (!isValidPassword) {
      throw new UnAuthorizError();
    }

    const token = generateToken(
      {
        session_id: `${user.id}:${user.userId}:${user.email}`,
      },
      ServerConfigs.TOKEN_SECRET
    );

    user.password = null;

    return {
      data: {
        token: token,
        user: user,
      },
      message: "admin login successfull",
    };
  }

  public async sendForgerPassLink(email: string): Promise<any> {
    try {
      const user = await this.userRepository.userExistWithEmail(email);
      if (!user || !user.email) {
        throw new BadRequestError("Invalid credentials");
      }

      const resetToken = encryptPassword(user.email).toString();
      const setCache = await this.redis.setter(user.email, resetToken);
      logger.info(`[auth-service] Adding reset token: ${resetToken}`);

      const resetLink = `${ServerConfigs.CLIENT_HOST}/reset-password?token=${resetToken}&email=${email}`;
      sendResetLinkMail(user.email, resetLink);
      return {
        data: true,
        message: "Reset link sent successfully",
      };
    } catch (error: any) {
      throw new ServerError(error?.message);
    }
  }

  public async resetPassword(
    email: string,
    password: string,
    token: string
  ): Promise<any> {
    try {
      const user = await this.userRepository.userExistWithEmail(email);
      if (!user || !user.email) {
        throw new BadRequestError("Invalid credentials");
      }

      const cachedToken = await this.redis.getter(user.email);
      logger.info(`Cached token : ${cachedToken}`);
      if (!cachedToken || token !== cachedToken) {
        throw new BadRequestError("Invalid reset request");
      }

      const encryptedPassword = encryptPassword(password);
      const updatePassword = this.userRepository.updatePassword(
        user.email,
        encryptedPassword
      );

      logger.info(`Password updated: ${updatePassword}`);

      return {
        data: true,
        message: "password updated successfully. please login!",
      };
    } catch (error: any) {
      throw new ServerError(error?.message);
    }
  }

  public async googleAuth(authCode: string, platform: string) {
    const res = await handleGoogleAuth(authCode);
    const payload = res.getPayload();
    if (!payload || !payload.email) {
      throw new UnAuthorizError("Invalid Google token or email not provided");
    }
    const { email, name, picture } = payload;
    // logger.info(`Google Auth User : ${JSON.stringify(data.getAttributes())}`);
    const nameSplit = name?.split(" ") || [""];
    let userInput: IGoogleResponse = {
      firstName: nameSplit[0],
      lastName: nameSplit[nameSplit.length - 1],
      email: email,
      profileImage: picture as string,
    };

    const userExists = await this.userRepository.userExistWithEmail(
      userInput.email
    );

    if (userExists && userInput.firstName && userInput.email) {
      if (!userExists.onboarded) {
        // create user inside user-service
        await publishUserEvent(KAFKA_EVENTS.USER_SIGNUP, {
          userId: userExists.userId,
          authId: userExists.id,
          email: userExists.email,
        });
        logger.debug("signup event published");
      } else {
        logger.warn("user is already onboarded");
      }
      const token = generateToken(
        {
          session_id: `${userExists.id}:${userExists.userId}:${userExists.email}`,
        },
        ServerConfigs.TOKEN_SECRET
      );
      logger.warn(`Generated Token : ${token}`);

      return {
        data: userExists,
        token: token,
        message: "Authentication successful",
      };
    } else {
      const userId = generateUUID();
      const createUser = await this.userRepository.createAuthUserWithGoogle({
        email,
        userId,
        provider: "google",
      });

      if (!createUser.onboarded) {
        // create user inside user-service
        await publishUserEvent(KAFKA_EVENTS.USER_SIGNUP, {
          userId: createUser.userId,
          authId: createUser.id,
          email: createUser.email,
        });
        logger.debug("signup event published");
      } else {
        logger.warn("user is already onboarded");
      }

      const token = generateToken(
        {
          session_id: `${createUser.id}:${createUser.userId}:${createUser.phoneNumber}`,
        },
        ServerConfigs.TOKEN_SECRET
      );
      logger.warn(`Generated Token : ${token}`);

      return {
        data: createUser,
        token: token,
        message: "OTP verification successful",
      };
    }
  }

  public async getAuthByUserId(userId: string): Promise<any> {
    try {
      const authData = await this.userRepository.findAuthByUserId(userId);
      
      if (!authData) {
        return null;
      }

      // Return only necessary auth data, exclude sensitive fields like password and otpCode
      const { password, otpCode, otpExpiresAt, ...safeAuthData } = authData.toJSON();
      
      return safeAuthData;
    } catch (error: any) {
      logger.error(`Error fetching auth data by userId: ${error.message}`);
      throw new ServerError("Failed to fetch auth data");
    }
  }
}
