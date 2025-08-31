import { ICreatePhoneAuthUser, IUpdateOTP } from "@/dtos/authRepo.dto";
import { Auth } from "@/models/auth.model";
import { logger, ServerError } from "@repo/common";
import { DB, IDatabase } from "../configs/database.config";

export default class UserRepository {
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
}
