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
import AuthRepository from "../repositories/auth.repository";
import { UserEvents } from "../utils/events/user.events";
import { publishUserEvent } from "../utils/kafka";
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
        await publishUserEvent(UserEvents.USER_SIGNUP, {
          userId: verifiedUser.userId,
          authId: verifiedUser.id,
          email: verifiedUser.email,
        });
        logger.debug("signup event published");
      }

      return {
        data: verifiedUser,
        message: "OTP verification successfull",
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
        auth_id: user.id,
        email: user.email,
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
}
