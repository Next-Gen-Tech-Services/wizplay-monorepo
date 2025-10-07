// src/repositories/contest.repository.ts
import { BadRequestError, logger, ServerError } from "@repo/common";
import { Transaction } from "sequelize";
import { DB, IDatabase } from "../configs/database.config";
import {
  CreateContestPayload,
  UpdateContestPayload,
} from "../dtos/contest.dto";
import { Contest } from "../models/contest.model";

export default class ContestRepository {
  private _DB: IDatabase = DB;

  constructor() {
    this._DB = DB;
  }

  public async createContest(data: CreateContestPayload): Promise<Contest> {
    try {
      const created = await this._DB.Contest.create(data);
      return created.toJSON() as Contest;
    } catch (err: any) {
      logger.error(`createContest DB error: ${err?.message ?? err}`);
      throw new ServerError("Database error creating contest");
    }
  }

  public async getContestById(id: string): Promise<Contest | null> {
    try {
      return await this._DB.Contest.findByPk(id);
    } catch (err: any) {
      logger.error(`getContestById DB error: ${err?.message ?? err}`);
      throw new ServerError("Database error");
    }
  }

  public async listContestsByMatch(
    matchId?: string,
    limit = 20,
    offset = 0,
    userId?: string
  ) {
    try {
      const where: any = matchId ? { matchId } : {};
      const include: any[] = [];

      // --- detect association alias between Contest -> UserContest (if any) ---
      const contestAssociations = this._DB.Contest.associations || {};
      const assocEntry = Object.values(contestAssociations).find(
        (a: any) => a && a.target && a.target === this._DB.UserContest
      );
      const userContestAlias =
        assocEntry && assocEntry.as ? assocEntry.as : null;

      // Only include join if we have a userId AND Sequelize knows the alias.
      // (This include is mainly to return any joined data if needed; we will compute hasJoined using a separate query.)
      if (userId && userContestAlias) {
        include.push({
          model: this._DB.UserContest,
          as: userContestAlias,
          required: false,
          where: { userId },
          attributes: ["id", "status", "contestId", "userId"],
        });
      }

      logger.info(
        `listContestsByMatch - userId: ${userId} alias: ${userContestAlias}`
      );

      const result = await this._DB.Contest.findAndCountAll({
        where,
        include,
        order: [["startAt", "ASC"]],
        limit,
        offset,
        distinct: true,
      });

      // Normalize count (handles edge cases with joins)
      let total: number;
      if (Array.isArray(result.count)) {
        try {
          total = result.count.reduce((acc: number, cur: any) => {
            if (typeof cur === "number") return acc + cur;
            if (cur && typeof cur === "object") {
              const c = "count" in cur ? Number((cur as any).count) : 0;
              return acc + (Number.isFinite(c) ? c : 0);
            }
            return acc;
          }, 0);
          if (total === 0 && result.count.length > 0)
            total = result.count.length;
        } catch {
          total = result.count.length;
        }
      } else {
        total = Number(result.count ?? 0);
      }

      // --- Robust hasJoined calculation: query user's joined contest IDs and build a Set ---
      let joinedContestIds = new Set<string>();
      if (userId) {
        const joinedRows = await this._DB.UserContest.findAll({
          where: { userId },
          attributes: ["contestId"],
          raw: true,
        });
        joinedRows.forEach((r: any) => {
          if (r && r.contestId) joinedContestIds.add(String(r.contestId));
        });
      }

      logger.info(
        `listContestsByMatch - userId: ${userId} joinedContestIds: ${JSON.stringify(
          Array.from(joinedContestIds)
        )}`
      );

      // Map contests and add hasJoined flag based on Set (guaranteed accurate)
      const items = result.rows.map((contest: any) => {
        const data = contest.toJSON();

        // If alias was included and present it could be used, but we prefer the joinedContestIds Set.
        const hasJoined = userId
          ? joinedContestIds.has(String(data.id))
          : false;

        // Remove any included join array to keep response clean regardless of alias name
        if (userContestAlias && data[userContestAlias])
          delete data[userContestAlias];
        if (data.userJoins) delete data.userJoins;
        if (data.userContests) delete data.userContests;

        return {
          ...data,
          hasJoined,
        };
      });

      return { items, total };
    } catch (err: any) {
      logger.error(`listContestsByMatch DB error: ${err?.message ?? err}`);
      throw new ServerError("Database error");
    }
  }

  public async updateContest(id: string, patch: UpdateContestPayload) {
    try {
      const [count] = await this._DB.Contest.update(patch, {
        where: { id },
        returning: true,
      });
      if (count === 0) throw new ServerError("Update failed");
      const updated = await this.getContestById(id);
      return updated;
    } catch (err: any) {
      logger.error(`updateContest DB error: ${err?.message ?? err}`);
      throw new ServerError("Database error");
    }
  }

  public async deleteContest(id: string) {
    try {
      const cnt = await this._DB.Contest.destroy({ where: { id } });
      return cnt > 0;
    } catch (err: any) {
      logger.error(`deleteContest DB error: ${err?.message ?? err}`);
      throw new ServerError("Database error");
    }
  }

  public async findById(id: string, options?: { transaction?: Transaction }) {
    try {
      return await this._DB.Contest.findByPk(id, {
        transaction: options?.transaction,
      });
    } catch (err: any) {
      logger.error(`findById DB error: ${err?.message ?? err}`);
      throw err;
    }
  }

  public async incrementFilledSpots(
    id: string,
    by = 1,
    options?: { transaction?: Transaction }
  ) {
    try {
      // underscored: true => DB column is filled_spots
      await this._DB.Contest.increment(
        {
          filledSpots: by as any,
        },
        { where: { id }, transaction: options?.transaction }
      );
      // return updated row if you want:
      return await this.findById(id, options);
    } catch (err: any) {
      logger.error(`incrementFilledSpots DB error: ${err?.message ?? err}`);
      throw err;
    }
  }

  /** questions */

  public async saveBulkQuestions(data: any) {
    if (!data.length) {
      throw new BadRequestError("invalid matches value");
    }

    const result = await this._DB.Question.bulkCreate(data);
    logger.info(`Inserted bulk data inside matches`);

    return result;
  }

  public async saveBulkContests(data: any) {
    if (!data.length) {
      throw new BadRequestError("invalid contests value");
    }

    const result = await this._DB.Contest.bulkCreate(data);
    logger.info(`Inserted bulk data inside contests`);

    return result;
  }
}
