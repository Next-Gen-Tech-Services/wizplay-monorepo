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

      // --- Compute hasJoined and isJoined based on user state ---
      // hasJoined: TRUE only if user has SUBMITTED answers (blocks further submissions)
      // isJoined: TRUE if user has joined the contest (for fee logic - don't charge again)
      //
      // Cases:
      // 1. First time joining: hasJoined=false, isJoined=false → charge fee, allow join & submit
      // 2. Joined but not submitted: hasJoined=false, isJoined=true → no fee, allow submit
      // 3. Joined and submitted: hasJoined=true, isJoined=true → block further action
      let hasJoined = false;
      let isJoined = false;
      
      if (userId) {
        // Check if user has joined the contest
        const joined = await this._DB.UserContest.findOne({
          where: { userId, contestId: id },
          attributes: ["id"],
          raw: true,
        });
        isJoined = !!joined;
        
        // Check if user has submitted answers
        const submission = await this._DB.UserSubmission.findOne({
          where: { userId, contestId: id },
          attributes: ["id"],
          raw: true,
        });
        
        // hasJoined is TRUE only if user has SUBMITTED (not just joined)
        hasJoined = !!submission;
        
        logger.info(`[CONTEST-REPO] Contest ${id} - User ${userId}: isJoined=${isJoined}, hasJoined(submitted)=${hasJoined}`);
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
        hasJoined : hasJoined && isJoined,  // TRUE only if user has SUBMITTED answers
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
    userId?: string,
    statusFilter?: string[]
  ) {
    try {
      const where: any = matchId ? { matchId } : {};
      
      // Apply status filter if provided (e.g., only upcoming and live)
      if (statusFilter && statusFilter.length > 0) {
        where.status = statusFilter;
      }
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
      let submittedContestIds = new Set<string>();
      
      if (userId) {
        logger.info(`[CONTEST-REPO] Fetching contest data for userId: ${userId}`);
        
        // Get contests where user has joined
        const joinedRows = await this._DB.UserContest.findAll({
          where: { userId },
          attributes: ["contestId"],
          raw: true,
        });
        logger.info(`[CONTEST-REPO] Found ${joinedRows.length} joined contests for user ${userId}`);
        joinedRows.forEach((r: any) => {
          if (r && r.contestId) {
            joinedContestIds.add(String(r.contestId));
            logger.debug(`[CONTEST-REPO]   → Joined: ${r.contestId}`);
          }
        });
        
        // Get contests where user has submitted answers
        const submittedRows = await this._DB.UserSubmission.findAll({
          where: { userId },
          attributes: ["contestId"],
          raw: true,
        });
        logger.info(`[CONTEST-REPO] Found ${submittedRows.length} submitted contests for user ${userId}`);
        submittedRows.forEach((r: any) => {
          if (r && r.contestId) {
            submittedContestIds.add(String(r.contestId));
            logger.debug(`[CONTEST-REPO]   → Submitted: ${r.contestId}`);
          }
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
        
        // hasJoined: TRUE only if user has SUBMITTED answers (blocks further submissions)
        // isJoined: TRUE if user has joined the contest (for fee logic - don't charge again)
        //
        // Cases:
        // 1. First time: hasJoined=false, isJoined=false → charge fee, allow join & submit
        // 2. Joined no submit: hasJoined=false, isJoined=true → no fee, allow submit
        // 3. Joined + submitted: hasJoined=true, isJoined=true → block further action
        const contestId = String(data.id);
        const hasJoined = userId ? submittedContestIds.has(contestId) : false;
        const isJoined = userId ? joinedContestIds.has(contestId) : false;
        
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
        return { ...data, hasJoined : hasJoined && isJoined, rankRanges };
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
        order: [["rankFrom", "ASC"]],
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

  /**
   * Get all contests for a specific match
   */
  public async getContestsByMatchId(matchId: string): Promise<Contest[]> {
    try {
      const contests = await this._DB.Contest.findAll({
        where: { matchId },
        raw: true,
      });
      return contests as Contest[];
    } catch (err: any) {
      logger.error(`getContestsByMatchId DB error: ${err?.message ?? err}`);
      throw new ServerError("Database error fetching contests by matchId");
    }
  }

  /**
   * Update contest status
   */
  public async updateContestStatus(contestId: string, status: string): Promise<void> {
    try {
      const [affectedRows] = await this._DB.Contest.update(
        { status: status as any },
        { where: { id: contestId } }
      );
      
      if (affectedRows === 0) {
        logger.warn(`[CONTEST-REPO] No contest found with id ${contestId} to update status`);
      } else {
        logger.info(`[CONTEST-REPO] Successfully updated contest ${contestId} status to ${status}`);
      }
    } catch (err: any) {
      logger.error(`updateContestStatus DB error: ${err?.message ?? err}`);
      throw new ServerError("Database error updating contest status");
    }
  }

  /**
   * Get contests by status
   */
  public async getContestsByStatus(status: string, matchId?: string): Promise<any[]> {
    try {
      const where: any = { status };
      if (matchId) {
        where.matchId = matchId;
      }

      const contests = await this._DB.Contest.findAll({
        where,
        attributes: ['id', 'matchId', 'title', 'type', 'status', 'createdAt', 'updatedAt'],
        raw: true,
      });

      return contests;
    } catch (err: any) {
      logger.error(`getContestsByStatus DB error: ${err?.message ?? err}`);
      throw new ServerError("Database error fetching contests by status");
    }
  }

  /**
   * Get all active contests (not completed or cancelled)
   */
  public async getActiveContests(): Promise<Contest[]> {
    try {
      const { Op } = require('sequelize');
      const contests = await this._DB.Contest.findAll({
        where: {
          status: {
            [Op.notIn]: ['completed', 'cancelled']
          }
        },
        attributes: ['id', 'matchId', 'title', 'type', 'status'],
        raw: true,
      });
      return contests as Contest[];
    } catch (err: any) {
      logger.error(`getActiveContests DB error: ${err?.message ?? err}`);
      throw new ServerError("Database error fetching active contests");
    }
  }

  /**
   * Get all questions for a contest
   */
  public async getQuestionsByContestId(contestId: string): Promise<any[]> {
    try {
      const questions = await this._DB.Question.findAll({
        where: { contestId },
        raw: true,
      });
      return questions;
    } catch (err: any) {
      logger.error(`getQuestionsByContestId DB error: ${err?.message ?? err}`);
      throw new ServerError("Database error fetching questions");
    }
  }

  /**
   * Update question answer
   */
  public async updateQuestionAnswer(questionId: string, answer: any): Promise<void> {
    try {
      await this._DB.Question.update(
        { ansKey: answer },
        { where: { id: questionId } }
      );
    } catch (err: any) {
      logger.error(`updateQuestionAnswer DB error: ${err?.message ?? err}`);
      throw new ServerError("Database error updating question answer");
    }
  }

  /**
   * Get all user submissions for a contest
   */
  public async getUserSubmissionsByContestId(contestId: string): Promise<any[]> {
    try {
      const submissions = await this._DB.UserSubmission.findAll({
        where: { contestId },
        raw: true,
      });
      return submissions;
    } catch (err: any) {
      logger.error(`getUserSubmissionsByContestId DB error: ${err?.message ?? err}`);
      throw new ServerError("Database error fetching submissions");
    }
  }

  /**
   * Update submission score
   */
  public async updateSubmissionScore(submissionId: string, points: number, isCorrect: boolean): Promise<void> {
    try {
      await this._DB.UserSubmission.update(
        { points, isCorrect } as any,
        { where: { id: submissionId } }
      );
    } catch (err: any) {
      logger.error(`updateSubmissionScore DB error: ${err?.message ?? err}`);
      throw new ServerError("Database error updating submission score");
    }
  }

  /**
   * Get user contest scores aggregated
   */
  public async getUserContestScores(contestId: string): Promise<any[]> {
    try {
      // Get all submissions grouped by user with their totalScore
      // Note: Using snake_case column names because model has underscored: true
      const submissions = await this._DB.UserSubmission.findAll({
        where: { contestId },
        attributes: [
          'userId',
          [this._DB.sequelize.fn('MAX', this._DB.sequelize.col('total_score')), 'totalScore'],
          [this._DB.sequelize.fn('MAX', this._DB.sequelize.col('max_score')), 'maxScore'],
        ],
        group: ['user_id'],
        raw: true,
      });

      if (!submissions || submissions.length === 0) {
        logger.info(`[CONTEST-REPO] No submissions found for contest ${contestId}`);
        return [];
      }

      // Sort by totalScore descending and add ranks
      const sorted = submissions.sort((a: any, b: any) => (b.totalScore || 0) - (a.totalScore || 0));
      
      const scores = sorted.map((score: any, index: number) => ({
        userId: score.userId || score.user_id,
        totalScore: score.totalScore || 0,
        maxScore: score.maxScore || 0,
        rank: index + 1,
      }));

      logger.info(`[CONTEST-REPO] Calculated scores for ${scores.length} users in contest ${contestId}`);
      return scores;
    } catch (err: any) {
      logger.error(`getUserContestScores DB error: ${err?.message ?? err}`);
      logger.error(`getUserContestScores DB stack: ${err?.stack || 'No stack'}`);
      throw new ServerError("Database error fetching user scores");
    }
  }

  /**
   * Update user contest final score and rank
   */
  public async updateUserContestScore(contestId: string, userId: string, totalScore: number, rank: number): Promise<void> {
    try {
      const result = await this._DB.UserContest.update(
        { score: totalScore, rank } as any,
        { where: { contestId, userId } }
      );
      logger.info(`[CONTEST-REPO] Updated UserContest for user ${userId} in contest ${contestId}: score=${totalScore}, rank=${rank}`);
    } catch (err: any) {
      logger.error(`updateUserContestScore DB error: ${err?.message ?? err}`);
      throw new ServerError("Database error updating user contest score");
    }
  }

  /**
   * Get all user contests with their ranks for prize distribution
   */
  public async getUserContestsWithRanks(contestId: string): Promise<any[]> {
    try {
      const userContests = await this._DB.UserContest.findAll({
        where: { contestId },
        attributes: ['userId', 'contestId', 'score', 'rank'],
        order: [['rank', 'ASC']],
        raw: true,
      });
      logger.info(`[CONTEST-REPO] Found ${userContests.length} user contests for prize distribution in contest ${contestId}`);
      return userContests;
    } catch (err: any) {
      logger.error(`getUserContestsWithRanks DB error: ${err?.message ?? err}`);
      throw new ServerError("Database error fetching user contests with ranks");
    }
  }
}


