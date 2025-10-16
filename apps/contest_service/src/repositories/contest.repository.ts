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

  public async saveBulkContests(data: any[]) {
    if (!data || !data.length) {
      throw new BadRequestError("invalid contests value");
    }

    // Start transaction so contests + prize rows are atomic
    const tx: Transaction = await this._DB.sequelize.transaction();
    try {
      // bulk create contests inside tx, return created rows
      const createdRows = await this._DB.Contest.bulkCreate(data, {
        transaction: tx,
        returning: true,
      });

      // For each created contest, compute prize distribution for winners = ceil(totalSpots * 0.6)
      for (const created of createdRows) {
        // `created` is a Sequelize instance; use get() or toJSON
        const contest = (created as any).toJSON
          ? (created as any).toJSON()
          : created;

        const prizePool = Number(contest.prizePool ?? 0);
        const totalSpots = Number(contest.totalSpots ?? 0);

        if (prizePool <= 0 || totalSpots <= 0) {
          // nothing to distribute, skip
          continue;
        }

        const WIN_RATIO = 0.6; // up to 60% users win
        const winners = Math.max(1, Math.ceil(totalSpots * WIN_RATIO));

        // DECAY controls how top-heavy the distribution is. >1 more top-heavy.
        // tweak DECAY = 1.0 (linear), 1.2..1.5 recommended for more top-heavy.
        const DECAY = 1.2;

        const perRank = this.generatePerRankDistribution(
          prizePool,
          winners,
          DECAY
        );

        // persist per-rank rows (uses your savePrizeBreakdown which accepts transaction)
        await this.savePrizeBreakdown(contest.id, perRank, { transaction: tx });
      }

      await tx.commit();
      logger.info(`Inserted bulk data inside contests: ${createdRows.length}`);
      return createdRows;
    } catch (err: any) {
      try {
        await tx.rollback();
      } catch (e) {
        logger.warn("rollback failed: " + String(e));
      }
      logger.error(`saveBulkContests DB error: ${err?.message ?? err}`);
      throw new ServerError("Database error while saving contests");
    }
  }

  /**
   * Generate per-rank rows using a weight function and normalize to prizePool.
   * - prizePool: total amount to distribute
   * - winners: number of winning ranks (1..winners)
   * - decay: exponential/power decay (1 => uniform weights; >1 => top-heavy)
   *
   * returns: Array<{ rank: number, amount: number }>
   */
  private generatePerRankDistribution(
    prizePool: number,
    winners: number,
    decay = 1.2
  ): { rank: number; amount: number }[] {
    if (!Number.isFinite(prizePool) || prizePool <= 0 || winners <= 0) {
      return [];
    }

    // Build raw weights: w_r = 1 / (r^decay)
    const weights: number[] = new Array(winners);
    for (let i = 0; i < winners; i++) {
      const rank = i + 1;
      weights[i] = 1 / Math.pow(rank, decay);
    }

    // Normalize weights to sum = prizePool
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const rawAmounts = weights.map((w) => (w / totalWeight) * prizePool);

    // Floor to integer amounts and distribute leftover cents starting from top rank
    const perRankFloored = rawAmounts.map((a) => Math.floor(a));
    const assigned = perRankFloored.reduce((s, v) => s + v, 0);
    let leftover = Math.round(prizePool - assigned);

    // distribute leftover (could be a few units) to top ranks one-by-one
    let idx = 0;
    while (leftover > 0 && idx < perRankFloored.length) {
      perRankFloored[idx] += 1;
      leftover -= 1;
      idx += 1;
      if (idx >= perRankFloored.length) idx = 0; // wrap if tiny leftover > winners
    }

    // Build final perRank rows
    const perRankRows = perRankFloored.map((amt, i) => ({
      rank: i + 1,
      amount: amt,
    }));

    return perRankRows;
  }

  public async savePrizeBreakdown(
    contestId: string,
    perRank: { rank: number; amount: number }[],
    options?: { transaction?: Transaction }
  ) {
    try {
      // delete existing per-rank rows for this contest
      await this._DB.ContestPrize.destroy({
        where: { contestId },
        transaction: options?.transaction,
      });

      if (perRank.length) {
        const rows = perRank.map((r) => ({
          contestId,
          rank: r.rank,
          amount: r.amount,
          rankFrom: r.rank, // or set appropriately based on your logic
          rankTo: r.rank, // or set appropriately based on your logic
          createdAt: new Date(),
          updatedAt: new Date(),
        }));
        await this._DB.ContestPrize.bulkCreate(rows, {
          transaction: options?.transaction,
        });
      }

      // update compact JSON on contest row for fast reads (slabs + total)
      const slabs = this.combineIntoSlabs(perRank);
      await this._DB.Contest.update(
        {
          prizeBreakdown: {
            perRank,
            slabs,
            totalAssigned: perRank.reduce((a, b) => a + b.amount, 0),
          },
        },
        { where: { id: contestId }, transaction: options?.transaction }
      );

      return true;
    } catch (err: any) {
      logger.error(`savePrizeBreakdown DB error: ${err?.message ?? err}`);
      throw new ServerError("Database error saving prize breakdown");
    }
  }

  public async getPrizeBreakdown(contestId: string) {
    try {
      const rows = await this._DB.ContestPrize.findAll({
        where: { contestId },
        order: [["rank", "ASC"]],
      });
      return rows.map((r: any) => r.toJSON());
    } catch (err: any) {
      logger.error(`getPrizeBreakdown DB error: ${err?.message ?? err}`);
      throw new ServerError("Database error");
    }
  }

  private async combineIntoSlabs(perRank: { rank: number; amount: number }[]) {
    if (!perRank.length) return [];
    const slabs = [];
    let curFrom = perRank[0].rank;
    let curTo = perRank[0].rank;
    let curAmt = perRank[0].amount;
    for (let i = 1; i < perRank.length; i++) {
      const r = perRank[i];
      if (r.amount === curAmt && r.rank === curTo + 1) {
        curTo = r.rank;
      } else {
        slabs.push({
          from: curFrom,
          to: curTo,
          amountPerRank: curAmt,
          total: curAmt * (curTo - curFrom + 1),
        });
        curFrom = r.rank;
        curTo = r.rank;
        curAmt = r.amount;
      }
    }
    slabs.push({
      from: curFrom,
      to: curTo,
      amountPerRank: curAmt,
      total: curAmt * (curTo - curFrom + 1),
    });
    return slabs;
  }
}
