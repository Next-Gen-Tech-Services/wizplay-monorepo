// src/repositories/contest.repository.ts
import { BadRequestError, logger, ServerError } from "@repo/common";
import { Transaction } from "sequelize";
import { DB, IDatabase } from "../configs/database.config";
import ServerConfigs from "../configs/server.config";
import {
  CreateContestPayload,
  UpdateContestPayload,
} from "../dtos/contest.dto";
import { Contest } from "../models/contest.model";
import axios from "axios";

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

  public async getContestById(
    id: string,
    userId?: string
  ): Promise<any | null> {
    try {
      const contest = await this._DB.Contest.findByPk(id);
      if (!contest) return null;

      const data = contest.toJSON();
      const d = data as any; // <-- cast to any once for dynamic fields

      // --- optional: compute hasJoined if userId provided ---
      let hasJoined = false;
      if (userId) {
        const joined = await this._DB.UserContest.findOne({
          where: { userId, contestId: id },
          attributes: ["id"],
          raw: true,
        });
        hasJoined = !!joined;
      }

      // Helper: compress a single contest's rank/prize array into consecutive ranges with same amount
      const compressRankArray = (
        rankArray: any[]
      ): Array<{
        from: number;
        to: number;
        amount: number;
        totalPayout?: number;
      }> => {
        if (!Array.isArray(rankArray) || rankArray.length === 0) return [];
        const normalized = rankArray
          .map((r: any) => {
            const rank = Number(r.rank ?? r.position ?? r.pos ?? NaN);
            const amount = Number(r.amount ?? r.prize ?? r.reward ?? 0);
            return Number.isFinite(rank) ? { rank, amount } : null;
          })
          .filter(Boolean) as Array<{ rank: number; amount: number }>;
        if (normalized.length === 0) return [];
        normalized.sort((a, b) => a.rank - b.rank);
        const ranges: Array<{
          from: number;
          to: number;
          amount: number;
          totalPayout?: number;
        }> = [];
        let curFrom = normalized[0].rank;
        let curTo = normalized[0].rank;
        let curAmount = normalized[0].amount;
        for (let i = 1; i < normalized.length; i++) {
          const item = normalized[i];
          const isConsecutive = item.rank === curTo + 1;
          const sameAmount = item.amount === curAmount;
          if (isConsecutive && sameAmount) {
            curTo = item.rank;
          } else {
            ranges.push({
              from: curFrom,
              to: curTo,
              amount: curAmount,
              totalPayout: curAmount * (curTo - curFrom + 1),
            });
            curFrom = item.rank;
            curTo = item.rank;
            curAmount = item.amount;
          }
        }
        ranges.push({
          from: curFrom,
          to: curTo,
          amount: curAmount,
          totalPayout: curAmount * (curTo - curFrom + 1),
        });
        return ranges;
      };

      // derive rankArray from known locations using the `d` any-cast
      const rankArray =
        d.prizeBreakdown?.perRank ??
        d.ranks ??
        d.prizeBreakup ??
        d.prize ??
        null;
      const rankRanges = compressRankArray(rankArray);

      // clean up any joined association keys if present
      const contestAssociations = this._DB.Contest.associations || {};
      const assocEntry = Object.values(contestAssociations).find(
        (a: any) => a && a.target && a.target === this._DB.UserContest
      );
      const userContestAlias =
        assocEntry && assocEntry.as ? assocEntry.as : null;
      if (userContestAlias && d[userContestAlias]) delete d[userContestAlias];
      if (d.userJoins) delete d.userJoins;
      if (d.userContests) delete d.userContests;

      logger.info(`[CONTEST-REPO] Fetching match data for contest ${id}`);
      // Fetch match data if matchId exists
      let matchData = null;
      if (d.matchId) {
        try {
          const matchServiceUrl = ServerConfigs.MATCHES_SERVICE_URL || "http://localhost:4003";
          // Use the matches list endpoint filtered by the specific match ID
          const matchResponse = await axios.get(
            `${matchServiceUrl}/api/v1/matches/${d.matchId}`,
            {
              headers: {
                'Content-Type': 'application/json'
              }
            }
          );
          
          // Extract the first match from the response
          matchData = matchResponse.data?.data || [];
        } catch (matchErr: any) {
          logger.error(`Failed to fetch match data for contest ${id}: ${matchErr?.message ?? matchErr}`);
          // Don't throw error, just set matchData to null
        }
      }

      return {
        ...d,
        hasJoined,
        rankRanges, // [{from, to, amount, totalPayout}, ...]
        matchData, // populated match data
      };
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

      const contestAssociations = this._DB.Contest.associations || {};
      const assocEntry = Object.values(contestAssociations).find(
        (a: any) => a && a.target && a.target === this._DB.UserContest
      );
      const userContestAlias =
        assocEntry && assocEntry.as ? assocEntry.as : null;

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

      const compressRankArray = (
        rankArray: any[]
      ): Array<{
        from: number;
        to: number;
        amount: number;
        totalPayout?: number;
      }> => {
        if (!Array.isArray(rankArray) || rankArray.length === 0) return [];
        const normalized = rankArray
          .map((r: any) => {
            const rank = Number(r.rank ?? r.position ?? r.pos ?? NaN);
            const amount = Number(r.amount ?? r.prize ?? r.reward ?? 0);
            return Number.isFinite(rank) ? { rank, amount } : null;
          })
          .filter(Boolean) as Array<{ rank: number; amount: number }>;
        if (normalized.length === 0) return [];
        normalized.sort((a, b) => a.rank - b.rank);
        const ranges: Array<{
          from: number;
          to: number;
          amount: number;
          totalPayout?: number;
        }> = [];
        let curFrom = normalized[0].rank;
        let curTo = normalized[0].rank;
        let curAmount = normalized[0].amount;
        for (let i = 1; i < normalized.length; i++) {
          const item = normalized[i];
          const isConsecutive = item.rank === curTo + 1;
          const sameAmount = item.amount === curAmount;
          if (isConsecutive && sameAmount) {
            curTo = item.rank;
          } else {
            ranges.push({
              from: curFrom,
              to: curTo,
              amount: curAmount,
              totalPayout: curAmount * (curTo - curFrom + 1),
            });
            curFrom = item.rank;
            curTo = item.rank;
            curAmount = item.amount;
          }
        }
        ranges.push({
          from: curFrom,
          to: curTo,
          amount: curAmount,
          totalPayout: curAmount * (curTo - curFrom + 1),
        });
        return ranges;
      };

      const items = result.rows.map((contest: any) => {
        const data = contest.toJSON();
        const hasJoined = userId
          ? joinedContestIds.has(String(data.id))
          : false;
        if (userContestAlias && data[userContestAlias])
          delete data[userContestAlias];
        if (data.userJoins) delete data.userJoins;
        if (data.userContests) delete data.userContests;
        const rankArray =
          data.prizeBreakdown?.perRank ??
          data.ranks ??
          data.prizeBreakup ??
          data.prize ??
          null;
        const rankRanges = compressRankArray(rankArray);
        return { ...data, hasJoined, rankRanges };
      });

      // Fetch match data for all contests
      logger.info(`[CONTEST-REPO] Fetching match data for ${items.length} contests`);
      const itemsWithMatchData = await Promise.all(
        items.map(async (item) => {
          let matchData = null;
          if (item.matchId) {
            try {
              const matchServiceUrl = ServerConfigs.MATCHES_SERVICE_URL || "http://localhost:4003";
              const matchResponse = await axios.get(
                `${matchServiceUrl}/api/v1/matches/${item.matchId}`,
                {
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  timeout: 3000, // 3 second timeout
                }
              );
              matchData = matchResponse.data?.data || null;
            } catch (matchErr: any) {
              logger.error(`Failed to fetch match data for contest ${item.id}: ${matchErr?.message ?? matchErr}`);
              // Don't throw error, just set matchData to null
            }
          }
          return { ...item, matchData };
        })
      );

      return { items: itemsWithMatchData, total };
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
      // Use transaction to ensure all-or-nothing deletion
      const result = await this._DB.sequelize.transaction(async (t) => {
        // 1. Delete all user submissions for this contest
        await this._DB.UserSubmission.destroy({
          where: { contestId: id },
          transaction: t,
        });

        // 2. Delete all user contest entries (joined users)
        await this._DB.UserContest.destroy({
          where: { contestId: id },
          transaction: t,
        });

        // 3. Delete all questions for this contest
        await this._DB.Question.destroy({
          where: { contestId: id },
          transaction: t,
        });

        // 4. Delete contest prizes
        await this._DB.ContestPrize.destroy({
          where: { contestId: id },
          transaction: t,
        });

        // 5. Finally, delete the contest itself
        const cnt = await this._DB.Contest.destroy({
          where: { id },
          transaction: t,
        });

        return cnt > 0;
      });

      return result;
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
