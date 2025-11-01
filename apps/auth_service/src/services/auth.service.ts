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
import { handleGoogleAuth, oauth2client } from "../utils/google-config";
import { publishUserEvent } from "../utils/kafka";
import { sendOtpUtil } from "../utils/otp";
import { sendResetLinkMail } from "../utils/smtp";
import { generateOTPUtil, generateUUID } from "../utils/utils";
import axios from "axios";

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

    const otpCode: string = generateOTPUtil();
    logger.warn(`OTP Code : ${otpCode}`);

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

      if (ServerConfigs.MSG91_BASE_URL) {
        await sendOtpUtil(phoneNumber, otpCode);
      }

      return {
        data: {
          userId: createUser.userId,
        },
        message: "otp sent successfully",
      };
    }
  }

  public async verifyOtp(phoneNumber: string, otpCode: string): Promise<any> {
    try {
      const verifiedUser = await this.userRepository.verifyOtpRepo({
        phoneNumber,
        otpCode,
      });

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
        // create user inside user-service
        await publishUserEvent(KAFKA_EVENTS.USER_SIGNUP, {
          userId: verifiedUser.userId,
          authId: verifiedUser.id,
          phoneNumber: phoneNumber,
        });
        logger.debug("signup event published");
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
      logger.info(`[auth-service] Adding reset token: ${setCache}`);

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
    const { email, name, picture } = res.payload;
    // logger.info(`Google Auth User : ${JSON.stringify(data.getAttributes())}`);
    const nameSplit = name.split(" ");
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
}
