import { logger } from "@repo/common";
import { DB, IDatabase } from "../configs/database.config";
import { KAFKA_EVENTS, Language } from "../types";
import { publishUserEvent } from "../utils/kafka";
import { generateUniqueUsername } from "../utils/username";

export default class UserRepository {
  private _DB: IDatabase = DB;
  constructor() {
    this._DB = DB;
  }

  public async createUser(
    userId: string,
    authId: string,
    email?: string
  ): Promise<any> {
    try {
      const generatedUsername = generateUniqueUsername();
      const newUser = await this._DB.User.create(
        {
          authId,
          userId,
          type: "user",
          userName: generatedUsername,
          selectedLanguage: Language.ENGLISH,
        },
        {
          returning: true,
        }
      );

      if (newUser) {
        await publishUserEvent(KAFKA_EVENTS.USER_ONBOARDED, {
          userId: newUser.userId,
          authId: newUser.authId,
        });
      }
      return newUser;
    } catch (error: any) {
      logger.error(`[Error creating new user: ${error.message}]`);
    }
  }

  public async getUserWithId(userId: string, authId: string): Promise<any> {
    try {
      const user = await this._DB.User.findOne({
        where: {
          userId: userId,
          authId: authId,
        },
      });
      return user;
    } catch (error: any) {
      logger.error(`[Error creating new user: ${error.message}]`);
    }
  }

  public async updateWithId(
    userId: string,
    payload: { name: string; email: string }
  ): Promise<any> {
    try {
      const user = await this._DB.User.update(payload, {
        where: {
          userId: userId,
        },
        returning: true,
      });
      return user;
    } catch (error: any) {
      logger.error(`[Error updating user name: ${error.message}]`);
    }
  }
  public async findById(userId: string): Promise<any> {
    try {
      const user = await this._DB.User.findOne({
        where: {
          userId: userId,
        },
      });
      return user;
    } catch (error: any) {
      logger.error(`[Error fetching user details: ${error.message}]`);
    }
  }
}
