// src/repositories/userContest.repository.ts
import { logger } from "@repo/common";
import { Transaction } from "sequelize";
import { DB } from "../configs/database.config";

export default class UserContestRepository {
  private _DB = DB;

  constructor() {
    // noop
  }

  public async findActiveJoin(
    userId: string,
    contestId: string,
    options?: { transaction?: Transaction }
  ) {
    try {
      return await this._DB.UserContest.findOne({
        where: { userId, contestId, status: "active" },
        transaction: options?.transaction,
      });
    } catch (err: any) {
      logger.error(
        `UserContestRepository.findActiveJoin error: ${err?.message ?? err}`
      );
      throw err;
    }
  }

  public async create(
    payload: {
      userId: string;
      contestId: string;
      matchId?: string | null;
      status?: "active" | "inactive";
    },
    options?: { transaction?: Transaction }
  ) {
    try {
      const row = await this._DB.UserContest.create(payload as any, {
        transaction: options?.transaction,
      });
      return row;
    } catch (err: any) {
      logger.error(
        `UserContestRepository.create error: ${err?.message ?? err}`
      );
      throw err;
    }
  }

  // Optionally expose other useful methods like cancelJoin, listByUser etc.
}
