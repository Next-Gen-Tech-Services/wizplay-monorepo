import { logger } from "@repo/common";
import { DB, IDatabase } from "../configs/database.config";
import { Language } from "../types";
import { generateUniqueUsername } from "../utils/username";

export default class UserRepository {
  private _DB: IDatabase = DB;
  constructor() {
    this._DB = DB;
  }

  public async getTestData(): Promise<any> {}

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
      return newUser;
    } catch (error: any) {
      logger.error(`[Error creating new user: ${error.message}]`);
    }
  }
}
