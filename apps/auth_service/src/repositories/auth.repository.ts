import {
  IClearOtpPayload,
  ICreatePhoneAuthUser,
  IUpdateOTP,
  IVerifyOtpPayload,
} from "@/dtos/authRepo.dto";
import { Auth } from "@/models/auth.model";
import { logger, ServerError } from "@repo/common";
import { DB, IDatabase } from "../configs/database.config";

export default class MatchRepository {
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

  public async verifyOtpRepo({
    phoneNumber,
    otpCode,
  }: IVerifyOtpPayload): Promise<Auth | null> {
    try {
      const record = await this._DB.Auth.findOne({
        where: {
          phoneNumber,
          otpCode,
        },
      });
      return record ? (record.toJSON() as Auth) : null;
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
}
