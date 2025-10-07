// src/repositories/contest.repository.ts
import { DB, IDatabase } from "../configs/database.config";

export default class WalletRepository {
  private _DB: IDatabase = DB;

  constructor() {
    this._DB = DB;
  }

  // public async getWallet(data: CreateContestPayload): Promise<any> {
  //   try {
  //     const created = await this._DB.Contest.create(data);
  //     return created.toJSON() as Contest;
  //   } catch (err: any) {
  //     logger.error(`createContest DB error: ${err?.message ?? err}`);
  //     throw new ServerError("Database error creating contest");
  //   }
  // }
}
