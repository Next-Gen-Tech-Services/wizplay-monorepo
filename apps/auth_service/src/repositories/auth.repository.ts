import { logger, ServerError } from "@repo/common";
import { DB, IDatabase } from "../configs/database.config";
import {
  IClearOtpPayload,
  ICreateGoogleAuthUser,
  ICreatePhoneAuthUser,
  IUpdateOTP,
  IVerifyOtpPayload,
} from "../dtos/authRepo.dto";
import { Auth } from "../models/auth.model";

export default class AuthRepository {
  private _DB: IDatabase = DB;
  constructor() {
    this._DB = DB;
  }

  public async getTestData(): Promise<any> {}

  public async userWithPhoneExistRepo(
    phoneNumber: string
  ): Promise<Auth | null> {
    try {
      const user = await this._DB.Auth.findOne({
        where: {
          phoneNumber: phoneNumber,
        },
      });
      return user;
    } catch (error: any) {
      logger.error(`Database Error: ${error}`);
      throw new ServerError("Database Error");
    }
  }

  public async updateRecentOtp(data: IUpdateOTP): Promise<any> {
    try {
      const result = await this._DB.Auth.update(
        {
          otpCode: data.otpCode,
        },
        {
          where: {
            phoneNumber: data.phoneNumber,
          },
        }
      );
      return result;
    } catch (error: any) {
      logger.error(`Database Error: ${error}`);
      throw new ServerError("Database Error");
    }
  }

  public async createAuthUserWithPhone(
    data: ICreatePhoneAuthUser
  ): Promise<any> {
    try {
      const result = await this._DB.Auth.create({
        ...data,
        type: "user",
      });
      if (!result) {
        throw new ServerError("Database Error");
      }
      return result.toJSON();
    } catch (error: any) {
      logger.error(`Database Error: ${error}`);
      throw new ServerError("Database Error");
    }
  }

  public async createAuthUserWithGoogle(
    data: ICreateGoogleAuthUser
  ): Promise<any> {
    try {
      const result = await this._DB.Auth.create({
        ...data,
        type: "user",
      });
      if (!result) {
        throw new ServerError("Database Error");
      }
      return result.toJSON();
    } catch (error: any) {
      logger.error(`Database Error: ${error}`);
      throw new ServerError("Database Error");
    }
  }

  public async verifyOtpRepo({
    phoneNumber,
    otpCode,
  }: IVerifyOtpPayload): Promise<Auth | null> {
    try {
      const user = await this._DB.Auth.findOne({
        where: {
          phoneNumber,
          otpCode,
        },
      });
      return user ? (user.toJSON() as Auth) : null;
    } catch (error: any) {
      logger.error(`Database Error: ${error}`);
      throw new ServerError("Database Error");
    }
  }

  public async clearOtpAndMarkLoginRepo({
    phoneNumber,
    lastLoginAt,
  }: IClearOtpPayload): Promise<void> {
    try {
      const [count] = await this._DB.Auth.update(
        {
          otpCode: null,
          otpExpiresAt: null,
          lastLoginAt: lastLoginAt ?? new Date(),
        },
        { where: { phoneNumber } }
      );
      if (count === 0) {
        throw new ServerError("Update failed");
      }
    } catch (error: any) {
      logger.error(`Database Error: ${error}`);
      throw new ServerError("Database Error");
    }
  }

  public async userExistWithEmail(email: string): Promise<any> {
    try {
      const user = await this._DB.Auth.findOne({
        where: {
          email: email,
        },
      });

      return user;
    } catch (error: any) {
      logger.error(`Database Error: ${error}`);
      throw new ServerError("Database Error");
    }
  }

  public async updatePassword(email: string, password: string): Promise<any> {
    try {
      const result = await this._DB.Auth.update(
        {
          password: password,
        },
        {
          where: {
            email: email,
          },
        }
      );
      return result;
    } catch (error: any) {
      logger.error(`Database Error: ${error}`);
      throw new ServerError("Database Error");
    }
  }

  public async updateOnboardingStatus(
    userId: string,
    authId: string
  ): Promise<any> {
    try {
      // First check if user exists and current status
      const user = await this._DB.Auth.findOne({
        where: {
          userId: userId,
          id: authId,
        },
      });

      if (!user) {
        logger.warn(`User not found for userId: ${userId}, authId: ${authId}`);
        return false;
      }

      if (user.onboarded) {
        logger.info(`User already onboarded for userId: ${userId}, authId: ${authId}`);
        return true;
      }

      // Update onboarding status
      const result = await this._DB.Auth.update(
        {
          onboarded: true,
        },
        {
          where: {
            userId: userId,
            id: authId,
          },
          returning: true,
        }
      );
      
      logger.debug(`Update result: affected rows: ${result[0]}`);
      
      // result[0] is the number of affected rows
      if (result[0] >= 1) {
        return true;
      } else {
        logger.warn(`No rows updated for userId: ${userId}, authId: ${authId}`);
        return false;
      }
    } catch (error: any) {
      logger.error(`Database Error in updateOnboardingStatus: ${error.message || error}`);
      throw error;
    }
  }

  public async findAuthByUserId(userId: string): Promise<Auth | null> {
    try {
      const authData = await this._DB.Auth.findOne({
        where: {
          userId: userId,
        },
      });
      return authData;
    } catch (error: any) {
      logger.error(`Database Error in findAuthByUserId: ${error.message || error}`);
      throw new ServerError("Database Error");
    }
  }
}
