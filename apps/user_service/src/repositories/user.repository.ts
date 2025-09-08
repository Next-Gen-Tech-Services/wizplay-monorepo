import { DB, IDatabase } from "../configs/database.config";

export default class UserRepository {
  private _DB: IDatabase = DB;
  constructor() {
    this._DB = DB;
  }

  public async getTestData(): Promise<any> {}

  public async createUser(
    userId: string,
    authId: string,
    userName: string
  ): Promise<any> {}
}
