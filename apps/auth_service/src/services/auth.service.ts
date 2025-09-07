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
import Redis from "../configs/redis.config";
import ServerConfigs from "../configs/server.config";
import AuthRepository from "../repositories/auth.repository";
import { sendResetLinkMail } from "../utils/smtp";
import { generateOTPUtil, generateUUID } from "../utils/utils";

@autoInjectable()
export default class Service {
  private redis: any;

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
      // SEND OTP HERE

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

      // SEND OTP HERE
      return {
        data: {
          userId: createUser.userId,
        },
        message: "otp sent successfully",
      };
    }
  }

  public async verifyOtp(
    phoneNumber: string,
    otpCode: string
  ): Promise<{
    userId: string;
    userStatus: "new" | "existing";
    onboarded: boolean;
  }> {
    // Find record with valid (non-expired) OTP
    const verified = await this.userRepository.verifyOtpRepo({
      phoneNumber,
      otpCode,
    });
    if (!verified) {
      // Could be wrong OTP, expired OTP, or no record
      throw new Error("Invalid or expired OTP");
    }

    // Clear OTP + mark login time
    await this.userRepository.clearOtpAndMarkLoginRepo({
      phoneNumber,
      lastLoginAt: new Date(),
    });

    // Determine user status
    // If the profile isn't onboarded yet, treat this as a new user.
    // Otherwise, it's an existing user.
    const userStatus: "new" | "existing" = verified.onboarded
      ? "existing"
      : "new";

    return {
      userId: verified.userId,
      userStatus,
      onboarded: !!verified.onboarded,
    };
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

      const resetLink = `${ServerConfigs.CLIENT_HOST}/reset-password?token=${resetToken}`;
      sendResetLinkMail(user.email, resetLink);
      return {
        data: true,
        message: "Reset link sent successfully",
      };
    } catch (error: any) {
      throw new ServerError(error?.message);
    }
  }
}
