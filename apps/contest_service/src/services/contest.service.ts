// src/services/contest.service.ts
import { BadRequestError, logger, ServerError } from "@repo/common";
import { Op, Transaction } from "sequelize";
import { autoInjectable } from "tsyringe";
import { DB } from "../configs/database.config";
import {
  CreateContestPayload,
  UpdateContestPayload,
} from "../dtos/contest.dto";
import ContestRepository from "../repositories/contest.repository";
import UserContestRepository from "../repositories/userContest.repository";
import { KAFKA_EVENTS } from "../types";
import { GenerativeAi } from "../utils/generativeAi";
import { publishUserEvent } from "../utils/kafka";
import {
  formatContestsForBulkInsert,
  formatQuestions,
  formatQuestionsForBulkInsert,
} from "../utils/questionsFormatter";
import axios from "axios";
import ServerConfigs from "../configs/server.config";
export interface JoinContestPayload {
  userId: string;
  contestId: string;
  matchId?: string | null;
  authHeader?: string;
}

@autoInjectable()
export default class ContestService {
  private generativeAI: GenerativeAi;
  private userContestRepo: UserContestRepository;
  constructor(private readonly repo: ContestRepository) {
    this.generativeAI = new GenerativeAi();
    this.userContestRepo = new UserContestRepository();
  }

  public async createContest(payload: CreateContestPayload) {
    if (!payload.matchId) throw new BadRequestError("matchId required");
    // business rules could go here
    const created = await this.repo.createContest(payload);
    logger.info(`[contest-service] created contest ${created.id}`);
    return created;
  }

  public async listContests(
    matchId?: string,
    limit = 20,
    offset = 0,
    userId?: string,
    statusFilter?: string[]
  ) {
    // pass through to repository
    return this.repo.listContestsByMatch(matchId, limit, offset, userId, statusFilter);
  }

  public async getContest(id: string,userId?: string) {
    
    const c = await this.repo.getContestById(id, userId);
    if (!c) throw new BadRequestError("Contest not found");
    return c;
  }

  public async updateContest(id: string, patch: UpdateContestPayload) {
    // Get the current contest to check status change
    const currentContest = await this.repo.getContestById(id);
    if (!currentContest) {
      throw new BadRequestError("Contest not found");
    }

    const oldStatus = currentContest.status;
    const newStatus = patch.status;

    // Update the contest first
    const updated = await this.repo.updateContest(id, patch);

    // If status changed to "calculating", trigger the calculation process
    if (newStatus === 'calculating' && oldStatus !== 'calculating') {
      logger.info(`[CONTEST SERVICE] Status changed to calculating for contest ${id}, triggering calculation`);
      
      // Trigger calculation asynchronously (don't block the API response)
      this.triggerContestCalculation(id, currentContest.matchId).catch(err => {
        logger.error(`[CONTEST SERVICE] Error triggering calculation for contest ${id}: ${err?.message}`);
      });
    }

    return updated;
  }

  /**
   * Trigger contest calculation - fetch match data and process
   */
  private async triggerContestCalculation(contestId: string, matchId: string): Promise<void> {
    try {
      logger.info(`[CONTEST SERVICE] Fetching match data for calculation - contestId: ${contestId}, matchId: ${matchId}`);

      // Fetch match data from match_service
      const matchServiceUrl = ServerConfigs.MATCHES_SERVICE_URL;
      
      if (!matchServiceUrl) {
        logger.error(`[CONTEST SERVICE] Match service URL not configured`);
        throw new Error("Match service URL not configured");
      }

      logger.info(`[CONTEST SERVICE] Using match service URL: ${matchServiceUrl}`);

      // 1. Get basic match data from match by ID endpoint
      let matchData = null;
      try {
        const matchResponse = await axios.get(
          `${matchServiceUrl}/api/v1/matches/${matchId}`,
          {
            timeout: 30000,
            headers: { "Content-Type": "application/json" }
          }
        );

        logger.info(`[CONTEST SERVICE] Match data response received`, matchResponse.data);
        if (matchResponse.data?.success && matchResponse.data?.data) {
          matchData = matchResponse.data.data;
          logger.info(`[CONTEST SERVICE] Match data fetched for matchId: ${matchId}`);
        } else {
          logger.error(`[CONTEST SERVICE] Failed to fetch match data: ${JSON.stringify(matchResponse.data)}`);
          throw new Error("Failed to fetch match data");
        }
      } catch (matchErr: any) {
        logger.error(`[CONTEST SERVICE] Error fetching match data: ${matchErr?.message}`);
        logger.error(`[CONTEST SERVICE] Match fetch error details: ${JSON.stringify(matchErr?.response?.data || {})}`);
        throw new Error(`Failed to fetch match data: ${matchErr?.message}`);
      }

      // 2. Get live data and ball-by-ball data from live-score endpoint
      let liveData = null;
      let ballByBallData = null;
      
      try {
        const liveResponse = await axios.get(
          `${matchServiceUrl}/api/v1/matches/${matchData.key}/live-score`,
          {
            timeout: 30000,
            headers: { "Content-Type": "application/json" }
          }
        );

        if (liveResponse.data?.success && liveResponse.data?.data) {
          const liveResponseData = liveResponse.data.data;
          
          // Extract live data - check if it's wrapped in simplifiedData
          if (liveResponseData.simplifiedData) {
            liveData = liveResponseData.simplifiedData;
            ballByBallData = liveResponseData.simplifiedData?.ballByBallData || null;
          } else {
            liveData = liveResponseData;
            ballByBallData = liveResponseData?.ballByBallData || null;
          }
          
          logger.info(`[CONTEST SERVICE] Live data fetched successfully`);
          logger.info(`[CONTEST SERVICE] ballByBallData: ${ballByBallData ? 'present' : 'not available'}`);
        } else {
          logger.warn(`[CONTEST SERVICE] No live data available for match ${matchId}, using match data as fallback`);
        }
      } catch (liveErr: any) {
        logger.warn(`[CONTEST SERVICE] Failed to fetch live data: ${liveErr?.message}`);
        logger.warn(`[CONTEST SERVICE] Will use match data as fallback for live data`);
      }
      
      // Construct liveMatchData object for AI processing
      const liveMatchData = {
        match: matchData,
        live: liveData || matchData,
        ballByBallData: ballByBallData
      };

      logger.info(`[CONTEST SERVICE] Constructed liveMatchData object, processing contest calculation`);
      logger.info(`[CONTEST SERVICE] liveMatchData.match: ${matchData ? 'present' : 'missing'}`);
      logger.info(`[CONTEST SERVICE] liveMatchData.live: ${liveData ? 'from live endpoint' : 'using match data'}`);
      logger.info(`[CONTEST SERVICE] liveMatchData.ballByBallData: ${ballByBallData ? 'present' : 'missing'}`);

      // Process the contest calculation
      await this.processContestCalculation(contestId, matchId, liveMatchData);

      logger.info(`[CONTEST SERVICE] ✅ Contest calculation completed for contest ${contestId}`);
    } catch (error: any) {
      logger.error(`[CONTEST SERVICE] triggerContestCalculation error: ${error.message}`);
      logger.error(`[CONTEST SERVICE] Error stack: ${error.stack}`);
      
      // Mark contest as completed even on error to avoid stuck state
      try {
        await this.repo.updateContestStatus(contestId, 'completed');
        logger.warn(`[CONTEST SERVICE] Marked contest ${contestId} as completed despite calculation error`);
      } catch (statusErr: any) {
        logger.error(`[CONTEST SERVICE] Failed to update status: ${statusErr.message}`);
      }
    }
  }

  public async deleteContest(id: string) {
    return this.repo.deleteContest(id);
  }

  public async generateAIQuestions(
    matchData: any,
    contestDescription: any,
    contestId: any
  ) {
    try {
      const generatedQuestions = await this.generativeAI.generateQuestions(
        JSON.stringify(matchData),
        contestDescription
      );

      const key = Object.keys(generatedQuestions)[0];
      const formattedData = formatQuestions(
        generatedQuestions[key],
        contestId,
        matchData.key
      );

      const insertQuestions = await this.repo.saveBulkQuestions(formattedData);
      if (!insertQuestions) {
        throw new ServerError(
          "Something went wrong while generating the questions"
        );
      }
      return {
        data: insertQuestions,
        message: "questions generated successfully",
      };
    } catch (error: any) {
      logger.error(`[CONTEST SERVICE ERROR]: ${error.message}`);
    }
  }

  public async generateContests(matchData: any) {
    try {
      const contests = await this.generativeAI.generateContest(
        matchData
      );

      const contestRecords = formatContestsForBulkInsert(
        contests,
        matchData.id
      );
      const questionRecords = formatQuestionsForBulkInsert(
        contests,
        matchData.id
      );

      const bulkContests = await this.repo.saveBulkContests(contestRecords);
      const bulkQuestions = await this.repo.saveBulkQuestions(questionRecords);

      if (bulkQuestions) {
        await publishUserEvent(KAFKA_EVENTS.GENERATE_CONTEST, {
          matchId: matchData.id,
          contests: bulkContests,
        });
        logger.debug("generate contest event published!");
      }

      return {
        data: {
          contests: bulkContests,
          questions: bulkQuestions,
        },
        message: "generated contests successfully",
      };
    } catch (error: any) {
      logger.error(`[CONTEST SERVICE ERROR]: ${error.message}`);
    }
  }

  public async joinContest(payload: JoinContestPayload) {
    const { userId, contestId, matchId, authHeader } = payload;

    let tx: Transaction | null = null;
    let walletDeducted = false;

    try {
      tx = await DB.sequelize.transaction({
        isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ,
      });

      // 1) fetch contest (inside tx)
      const contest = await this.repo!.findById(contestId, { transaction: tx });
      if (!contest) {
        await tx.rollback();
        const e = new Error("Contest not found");
        (e as any).code = "NOT_FOUND";
        throw e;
      }

      // 2) Check contest status - only allow joining 'live' contests
      const contestStatus = contest.getDataValue("status") as string;
      if (contestStatus !== "live") {
        await tx.rollback();
        let message = "Contest is not open for joining";
        if (contestStatus === "upcoming") {
          message = "Contest is upcoming. Wait for it to go live before joining.";
        } else if (contestStatus === "joining_closed") {
          message = "Joining period has closed for this contest.";
        } else if (contestStatus === "completed") {
          message = "Contest has already completed.";
        } else if (contestStatus === "cancelled") {
          message = "Contest has been cancelled.";
        } else if (contestStatus === "calculating") {
          message = "Contest results are being calculated.";
        }
        throw new BadRequestError(message);
      }

      // 3) eligibility checks
      const nowSec = Math.floor(Date.now() / 1000);
      const startAt = contest.getDataValue("startAt") as number | null;
      const endAt = contest.getDataValue("endAt") as number | null;
      const joinDeadline = contest.getDataValue("joinDeadline") as
        | string
        | null;

      if (startAt && nowSec < startAt && joinDeadline === "before_match") {
        await tx.rollback();
        throw new BadRequestError("Contest not open for joining yet");
      }
      if (endAt && nowSec > endAt) {
        await tx.rollback();
        throw new BadRequestError("Contest already ended");
      }

      // 3) capacity check
      const totalSpots = contest.getDataValue("totalSpots") as number | null;
      const filledSpots = (contest.getDataValue("filledSpots") as number) ?? 0;
      if (
        typeof totalSpots === "number" &&
        totalSpots > 0 &&
        filledSpots >= totalSpots
      ) {
        await tx.rollback();
        throw new BadRequestError("Contest is full");
      }

      // 4) Check if user has already SUBMITTED answers → block completely
      const existingSubmission = await DB.UserSubmission.findOne({
        where: { userId, contestId },
        attributes: ["id"],
        transaction: tx,
      });
      if (existingSubmission) {
        await tx.rollback();
        const e = new Error("User has already submitted answers for this contest");
        (e as any).code = "ALREADY_SUBMITTED";
        throw e;
      }

      // 5) Check if user has already JOINED (but not submitted)
      // If already joined: skip fee deduction and creation, return existing record
      const existingJoin = await this.userContestRepo!.findActiveJoin(
        userId,
        contestId,
        { transaction: tx }
      );
      if (existingJoin) {
        await tx.commit();
        logger.info(
          `[contest-service] User ${userId} already joined contest ${contestId} - allowing re-entry for submission (no fee)`
        );
        // Return existing join record (user can proceed to submit)
        return existingJoin.toJSON();
      }

      // 6) deduct wallet balance (if entryFee > 0) - only for NEW joins
      const entryFee = contest.getDataValue("entryFee") as number | null;
      if (entryFee && entryFee > 0) {
        const walletUrl =
          ServerConfigs.WALLET_SERVICE_URL ?? "http://localhost:4006";
        const debitUrl = `${walletUrl}/api/v1/wallet/debit`;

        logger.info(
          `[contest-service] Deducting entry fee ${entryFee} for user ${userId} from wallet`
        );
        try {
          const resp = await axios.patch(
            debitUrl,
            {
              amount: entryFee,
              type: 'contest_entry'
            },
            {
              headers: authHeader ? { Authorization: authHeader } : {},
              timeout: 5000,
            }
          );

          if (!resp.data?.success) {
            throw new BadRequestError(
              resp.data?.message || "Failed to deduct wallet balance"
            );
          }
          walletDeducted = true;
          logger.info(
            `[contest-service] Wallet debited successfully for user ${userId}`
          );
        } catch (walletErr: any) {
          await tx.rollback();
          logger.error(
            `[contest-service] Wallet deduction failed: ${walletErr?.response?.data?.message || walletErr.message}`
          );
          throw new BadRequestError(
            walletErr?.response?.data?.message || "Insufficient wallet balance"
          );
        }
      }

      // 7) create join row
      const created = await this.userContestRepo!.create(
        {
          userId,
          contestId,
          matchId:
            matchId ?? (contest.getDataValue("matchId") as string | null),
          status: "active",
        },
        { transaction: tx }
      );

      // 8) increment filled spots atomically
      await this.repo!.incrementFilledSpots(contestId, 1, { transaction: tx });

      await tx.commit();

      // return created row (as plain JSON)
      return created.toJSON();
    } catch (err: any) {
      if (tx) {
        try {
          await tx.rollback();
        } catch (e) {
          logger.warn("rollback failed: " + String(e));
        }
      }

      // REFUND wallet if deduction was successful but DB failed
      if (walletDeducted) {
        logger.warn(
          `[contest-service] DB transaction failed after wallet debit; attempting refund for user ${userId}`
        );
        try {
          const walletUrl =
            process.env.WALLET_SERVICE_URL ?? "http://localhost:4006";
          const creditUrl = `${walletUrl}/api/v1/wallet/credit`;
          const entryFee =
            (await this.repo!.findById(contestId, {}))?.getDataValue(
              "entryFee"
            ) || 0;

          if (entryFee > 0 && authHeader) {
            await axios.patch(
              creditUrl,
              {
                amount: entryFee,
                type: 'contest_refund'
              },
              {
                headers: { Authorization: authHeader },
                timeout: 5000,
              }
            );
            logger.info(
              `[contest-service] Refunded ${entryFee} to user ${userId} after rollback`
            );
          }
        } catch (refundErr) {
          logger.error(
            `[contest-service] Refund failed: ${refundErr}. Manual intervention required for user ${userId}`
          );
        }
      }

      // detect DB unique constraint (concurrent join)
      const isUnique =
        err?.name === "SequelizeUniqueConstraintError" ||
        err?.parent?.code === "23505" ||
        (err?.original &&
          String(err.original).toLowerCase().includes("duplicate"));

      if (isUnique) {
        const e = new Error("User already joined this contest");
        (e as any).code = "CONFLICT";
        throw e;
      }

      // rethrow service-level known errors
      if (err instanceof BadRequestError) throw err;
      if ((err as any).code === "NOT_FOUND" || (err as any).code === "CONFLICT")
        throw err;

      logger.error(`ContestService.joinContest error: ${err?.message ?? err}`);
      throw new ServerError("Failed to join contest");
    }
  }

  public async userContest(userId: string) {
    try {
      const contests = await this.userContestRepo!.findAllUserContests(userId);

      // Populate match data for each contest
      const contestsWithMatchData = await Promise.all(
        contests.map(async (userContest: any) => {
          const contest = userContest.contest;

          if (contest?.matchId) {
            try {
              // Fetch match data from match service
              const matchResponse = await axios.get(
                `${ServerConfigs.MATCHES_SERVICE_URL}/api/v1/matches/${contest.matchId}`
              );

              // Add match data to contest
              const contestData = contest.toJSON ? contest.toJSON() : contest;
              return {
                ...userContest.toJSON(),
                matchData: matchResponse.data?.data || null,
                contest: contestData,

              };
            } catch (matchErr: any) {
              logger.warn(
                `Failed to fetch match data for matchId ${contest.matchId}: ${matchErr?.message}`
              );
              // Return contest without match data if fetch fails
              return userContest;
            }
          }

          return userContest;
        })
      );

      return contestsWithMatchData;
    } catch (err: any) {
      logger.error(`ContestService.userContest error: ${err?.message ?? err}`);
      throw new ServerError("Failed to fetch user contests");
    }
  }

  public async getUserContestHistory(userId: string) {
    try {
      const userContests = await this.userContestRepo!.findAllUserContests(userId);

      // Fetch submissions and rankings for each contest
      const contestsWithDetails = await Promise.all(
        userContests.map(async (userContest: any) => {
          const contest = userContest.contest;
          const contestId = userContest.contestId;

          // Get user's submission for this contest
          const submission = await DB.UserSubmission.findOne({
            where: { userId, contestId },
            attributes: ["totalScore", "maxScore", "createdAt"],
          });

          // Get user's rank in this contest
          let rank = null;
          let totalParticipants = 0;
          if (submission) {
            // Count how many submissions have higher score
            const higherScores = await DB.UserSubmission.count({
              where: {
                contestId,
                totalScore: { [Op.gt]: submission.totalScore },
              },
            });

            // Total participants
            totalParticipants = await DB.UserSubmission.count({
              where: { contestId },
            });

            rank = higherScores + 1;
          }

          // Fetch match data
          let matchData = null;
          let matchInfo = "Unknown Match";
          if (contest?.matchId) {
            try {
              const matchResponse = await axios.get(
                `${ServerConfigs.MATCHES_SERVICE_URL}/api/v1/matches/${contest.matchId}`,
                { timeout: 3000 }
              );
              if (matchResponse.data?.success && matchResponse.data.data) {
                matchData = matchResponse.data.data;
                const teamA = matchData.teamA?.name || matchData.teamA || "Team A";
                const teamB = matchData.teamB?.name || matchData.teamB || "Team B";
                matchInfo = `${teamA} vs ${teamB}`;
              }
            } catch (matchErr: any) {
              logger.debug(`Failed to fetch match ${contest.matchId}: ${matchErr?.message}`);
            }
          }

          // Determine status for user display
          // upcoming: Contest visible but not open for joining yet
          // ongoing: Contest is live or joining_closed or calculating (active)
          // completed: Results declared
          let status: "ongoing" | "completed" | "upcoming" = "ongoing";
          if (contest?.status === "completed") {
            status = "completed";
          } else if (contest?.status === "upcoming") {
            status = "upcoming";
          } else if (contest?.status === "live" || contest?.status === "joining_closed" || contest?.status === "calculating") {
            status = "ongoing";
          }

          // Calculate prize (simplified - you may want to implement actual prize distribution logic)
          let prize = 0;
          if (status === "completed" && rank && rank <= 3 && contest?.prizePool) {
            // Simple prize distribution for top 3
            if (rank === 1) prize = contest.prizePool * 0.5;
            else if (rank === 2) prize = contest.prizePool * 0.3;
            else if (rank === 3) prize = contest.prizePool * 0.2;
          }

          // Serialize contest data
          const contestData = contest?.toJSON ? contest.toJSON() : contest;

          return {
            id: userContest.id,
            contestId: contest?.id || contestId,
            contestTitle: contest?.title || "Unknown Contest",
            matchInfo,
            entryFee: contest?.entryFee || 0,
            rank,
            score: submission?.totalScore || 0,
            totalParticipants,
            prize: Math.round(prize),
            status,
            joinedAt: userContest.createdAt,
            // Include full contest and match data
            contest: contestData,
            matchData: matchData,
          };
        })
      );

      return contestsWithDetails;
    } catch (err: any) {
      logger.error(`ContestService.getUserContestHistory error: ${err?.message ?? err}`);
      throw new ServerError("Failed to fetch user contest history");
    }
  }

  /**
   * Get contest statistics for analytics dashboard
   */
  public async getContestStats() {
    try {
      const [
        total,
        scheduled,
        running,
        completed,
        totalParticipantsResult,
        totalPrizePoolResult
      ] = await Promise.all([
        // Total contests
        DB.Contest.count(),

        // Scheduled contests
        DB.Contest.count({
          where: { status: 'upcoming' }
        }),

        // Running contests
        DB.Contest.count({
          where: { status: ['live', 'calculating'] }
        }),

        // Completed contests
        DB.Contest.count({
          where: { status: 'completed' }
        }),

        // Total participants across all contests
        DB.UserContest.count(),

        // Total prize pool
        DB.Contest.sum('prizePool', {
          where: {
            prizePool: { [Op.ne]: null }
          }
        })
      ]);

      return {
        total,
        scheduled,
        running,
        completed,
        totalParticipants: totalParticipantsResult || 0,
        totalPrizePool: totalPrizePoolResult || 0,
      };
    } catch (err: any) {
      logger.error(`ContestService.getContestStats error: ${err?.message ?? err}`);
      throw new ServerError("Failed to fetch contest statistics");
    }
  }

  public async generateAnswers(
    matchData: any,
    liveData: any,
    question: any
  ): Promise<{ data: any; message: string } | undefined> {
    try {
      const generatedAnswers = await this.generativeAI.generateAnswers(
        matchData,
        liveData,
        question
      );

      return {
        data: generatedAnswers,
        message: "answers generated successfully",
      };
    }
    catch (error: any) {
      logger.error(`[CONTEST SERVICE ERROR]: ${error.message}`);
    }
  }

  /**
   * Get all contests for a specific match
   */
  public async getContestsByMatchId(matchId: string): Promise<any[]> {
    try {
      return await this.repo.getContestsByMatchId(matchId);
    } catch (error: any) {
      logger.error(`[CONTEST SERVICE] getContestsByMatchId error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update contest status
   */
  public async updateContestStatus(contestId: string, newStatus: string): Promise<void> {
    try {
      await this.repo.updateContestStatus(contestId, newStatus as any);
      logger.info(`[CONTEST SERVICE] Updated contest ${contestId} status to ${newStatus}`);
    } catch (error: any) {
      logger.error(`[CONTEST SERVICE] updateContestStatus error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Determine new contest status based on live match data
   */
  public async determineContestStatus(contest: any, liveMatchData: any): Promise<string | null> {
    try {
      const currentStatus = contest.status;
      const contestType = contest.type || '';
      
      // Extract match state from live data
      const matchStatus = liveMatchData.match?.status || '';
      const playStatus = liveMatchData.match?.playStatus || '';
      const tossCompleted = !!liveMatchData.toss?.winner;
      const currentInningsNumber = liveMatchData.live?.inningsNumber || 1;
      const currentOvers = parseFloat(liveMatchData.live?.currentScore?.overs || '0');
      
      logger.info(`[CONTEST SERVICE] Determining status for contest ${contest.id} (${contestType}): current=${currentStatus}, match=${matchStatus}, play=${playStatus}, toss=${tossCompleted}, inningsNum=${currentInningsNumber}, overs=${currentOvers}`);

      // Handle match cancellation
      if (matchStatus === 'cancelled' || matchStatus === 'abandoned') {
        return 'cancelled';
      }

      // Status transition logic based on contest type
      
      // Pre-match contests (full match predictions)
      if (contestType.includes('match') || contestType.includes('full')) {
        if (currentStatus === 'upcoming' && tossCompleted) {
          return 'live'; // Users can join after toss
        }
        if (currentStatus === 'live' && currentOvers > 0) {
          return 'joining_closed'; // First ball bowled, close joining
        }
        if (currentStatus === 'joining_closed' && (matchStatus === 'completed' || playStatus === 'result')) {
          return 'calculating'; // Match ended, calculate results
        }
      }
      
      // Phase-based contests (powerplay, middle, death)
      else if (contestType.includes('powerplay') || contestType.includes('middle') || contestType.includes('death')) {
        // Extract which innings this contest is for (1 or 2)
        const contestInningsNum = this.getContestInningsNumber(contestType);
        
        logger.info(`[CONTEST SERVICE] Phase contest ${contest.id}: contestInnings=${contestInningsNum}, currentInnings=${currentInningsNumber}, overs=${currentOvers}`);
        
        // Powerplay: overs 1-6
        if (contestType.includes('powerplay')) {
          if (currentStatus === 'upcoming' && tossCompleted) {
            return 'live'; // After toss, can join
          }
          if (currentStatus === 'live' && currentInningsNumber === contestInningsNum && currentOvers >= 0.1) {
            return 'joining_closed'; // Phase started
          }
          if (currentStatus === 'joining_closed' && currentInningsNumber === contestInningsNum && currentOvers >= 6.0) {
            return 'calculating'; // Powerplay ended
          }
        }
        
        // Middle overs: overs 7-15 (T20) or 7-40 (ODI)
        else if (contestType.includes('middle')) {
          const format = liveMatchData.match?.format || 't20';
          const middleEnd = format === 'odi' ? 40 : 15;
          
          if (currentStatus === 'upcoming' && tossCompleted) {
            return 'live';
          }
          if (currentStatus === 'live' && currentInningsNumber === contestInningsNum && currentOvers >= 6.1) {
            return 'joining_closed';
          }
          if (currentStatus === 'joining_closed' && currentInningsNumber === contestInningsNum && currentOvers >= middleEnd) {
            return 'calculating';
          }
        }
        
        // Death overs: overs 16-20 (T20) or 41-50 (ODI)
        else if (contestType.includes('death')) {
          const format = liveMatchData.match?.format || 't20';
          const deathStart = format === 'odi' ? 40 : 15;
          
          if (currentStatus === 'upcoming' && tossCompleted) {
            return 'live';
          }
          if (currentStatus === 'live' && currentInningsNumber === contestInningsNum && currentOvers >= deathStart + 0.1) {
            return 'joining_closed';
          }
          if (currentStatus === 'joining_closed' && (matchStatus === 'completed' || playStatus === 'result')) {
            return 'calculating';
          }
        }
      }

      // No status change
      return null;
      
    } catch (error: any) {
      logger.error(`[CONTEST SERVICE] determineContestStatus error: ${error.message}`);
      return null;
    }
  }

  /**
   * Get which innings a contest is for as a number (1 or 2)
   * Contest types like: t20_powerplay1, t20_powerplay2, t10_death1, t20_middle2, etc.
   * The last digit indicates the innings number
   */
  private getContestInningsNumber(contestType: string): number {
    // Extract the last character after the last underscore
    const parts = contestType.split('_');
    if (parts.length > 0) {
      const lastPart = parts[parts.length - 1]; // e.g., "powerplay1", "death2", "middle1"
      const lastChar = lastPart.charAt(lastPart.length - 1);
      
      if (lastChar === '2') {
        return 2;
      } else if (lastChar === '1') {
        return 1;
      }
    }
    
    // Default to innings 1 if can't determine
    logger.warn(`[CONTEST SERVICE] Could not determine innings from contestType: ${contestType}, defaulting to 1`);
    return 1;
  }

  /**
   * Get which innings a contest is for (innings1 or innings2)
   * Contest types like: t20_powerplay1, t20_powerplay2, t10_death1, t20_middle2, etc.
   * The last digit indicates the innings number
   */
  private getContestInnings(contestType: string): string {
    // Extract the last character after the last underscore
    const parts = contestType.split('_');
    if (parts.length > 0) {
      const lastPart = parts[parts.length - 1]; // e.g., "powerplay1", "death2", "middle1"
      const lastChar = lastPart.charAt(lastPart.length - 1);
      
      if (lastChar === '2') {
        return 'innings2';
      } else if (lastChar === '1') {
        return 'innings1';
      }
    }
    
    // Default to innings1 if can't determine
    logger.warn(`[CONTEST SERVICE] Could not determine innings from contestType: ${contestType}, defaulting to innings1`);
    return 'innings1';
  }

  /**
   * Normalize innings format from "b_1" to "innings1"
   */
  private normalizeInnings(rawInnings: string): string {
    if (!rawInnings) return '';
    
    // Handle "b_1" format (team_inningsNumber)
    const match = rawInnings.match(/_(\d+)$/);
    if (match) {
      return `innings${match[1]}`;
    }
    
    // Already in correct format
    if (rawInnings.startsWith('innings')) {
      return rawInnings;
    }
    
    return rawInnings;
  }

  /**
   * Process contest calculation - generate answers and calculate scores
   */
  public async processContestCalculation(
    contestId: string,
    matchId: string,
    liveMatchData: any
  ): Promise<void> {
    try {
      logger.info(`[CONTEST SERVICE] Starting calculation for contest ${contestId}`);

      // Get contest with questions
      const contest = await this.repo.getContestById(contestId);
      if (!contest) {
        throw new Error(`Contest ${contestId} not found`);
      }

      // Get all questions for this contest
      const questions = await this.repo.getQuestionsByContestId(contestId);
      if (!questions || questions.length === 0) {
        logger.warn(`[CONTEST SERVICE] No questions found for contest ${contestId}, marking as completed anyway`);
        // Still mark as completed even if no questions
        await this.repo.updateContestStatus(contestId, 'completed');
        return;
      }

      logger.info(`[CONTEST SERVICE] Processing ${questions.length} questions`);

      // Normalize liveMatchData structure
      // Handle different data structures from:
      // 1. triggerContestCalculation (from update contest API): { match, live, ballByBallData }
      // 2. updateContestStatuses (from livematch webhook): enhanced data with match/live at root level
      let matchData = liveMatchData.match || liveMatchData;
      let liveData = liveMatchData.live || liveMatchData;
      let ballByBallData = null;

      try {
        // Check for ballByBallData in different possible locations
        if (liveMatchData.ballByBallData) {
          ballByBallData = liveMatchData.ballByBallData;
        } else if (liveMatchData.simplifiedData?.ballByBallData) {
          ballByBallData = liveMatchData.simplifiedData.ballByBallData;
        }
        
        if (ballByBallData) {
          logger.info(`[CONTEST SERVICE] Retrieved ball-by-ball data from liveMatchData`);
        } else {
          logger.warn(`[CONTEST SERVICE] No ball-by-ball data found in liveMatchData`);
        }
      } catch (ballErr: any) {
        logger.error(`[CONTEST SERVICE] Error accessing ball-by-ball data: ${ballErr?.message}`);
      }

      logger.info(`[CONTEST SERVICE] Data structure: matchData=${matchData ? 'present' : 'missing'}, liveData=${liveData ? 'present' : 'missing'}, ballByBallData=${ballByBallData ? 'present' : 'missing'}`);

      // Generate answers for ALL questions at once using AI
      let successCount = 0;
      let failCount = 0;
      
      try {
        logger.info(`[CONTEST SERVICE] Calling AI to generate answers for all questions`);
        logger.info(`[CONTEST SERVICE] Questions sent to AI: ${JSON.stringify(questions.map(q => ({ id: q.id, question: q.question })))}`);
        
        // Call AI with normalized data - works for both webhook and update API sources
        const generatedAnswers = await this.generativeAI.generateAnswers(
          matchData,
          liveData,
          questions,
          ballByBallData // Pass ball-by-ball data to AI
        );

        logger.info(`[CONTEST SERVICE] AI returned response: ${JSON.stringify(generatedAnswers)}`);

        // Map answers back to questions and update
        if (generatedAnswers && Array.isArray(generatedAnswers)) {
          for (const answerData of generatedAnswers) {
            try {
              // Find matching question by questionId from AI response
              const question = questions.find(q => q.id === answerData.questionId);
              
              if (!question) {
                logger.warn(`[CONTEST SERVICE] No matching question found for questionId: ${answerData.questionId}`);
                failCount++;
                continue;
              }

              if (answerData.answer !== null && answerData.answer !== undefined) {
                // Update question with the answer
                await this.repo.updateQuestionAnswer(question.id, answerData.answer);
                logger.info(`[CONTEST SERVICE] ✅ Updated answer for question ${question.id}: "${answerData.answer}" (confidence: ${answerData.confidence})`);
                successCount++;
              } else {
                logger.warn(`[CONTEST SERVICE] Answer is null/undefined for question ${question.id}, reasoning: ${answerData.reasoning}`);
                // Still count as success but with null answer
                await this.repo.updateQuestionAnswer(question.id, null);
                successCount++;
              }
            } catch (updateErr: any) {
              logger.error(`[CONTEST SERVICE] Error updating question answer: ${updateErr?.message}`);
              failCount++;
            }
          }
        } else {
          logger.error(`[CONTEST SERVICE] AI did not return valid answers array. Type: ${typeof generatedAnswers}, Value: ${JSON.stringify(generatedAnswers)}`);
          failCount = questions.length;
        }
      } catch (aiErr: any) {
        logger.error(`[CONTEST SERVICE] AI generation failed: ${aiErr?.message}`);
        logger.error(`[CONTEST SERVICE] Stack: ${aiErr?.stack}`);
        failCount = questions.length;
      }

      logger.info(`[CONTEST SERVICE] Answer generation complete: ${successCount} success, ${failCount} failed`);

      // Calculate user scores
      await this.calculateUserScores(contestId);

      // Move contest to completed (always update status at the end)
      await this.repo.updateContestStatus(contestId, 'completed');
      logger.info(`[CONTEST SERVICE] ✅ Contest ${contestId} marked as completed (${successCount}/${questions.length} answers generated)`);

    } catch (error: any) {
      logger.error(`[CONTEST SERVICE] processContestCalculation error for contest ${contestId}: ${error.message}`);
      // Even on error, try to mark as completed to avoid stuck contests
      try {
        await this.repo.updateContestStatus(contestId, 'completed');
        logger.warn(`[CONTEST SERVICE] Marked contest ${contestId} as completed despite errors`);
      } catch (statusErr: any) {
        logger.error(`[CONTEST SERVICE] Failed to update status to completed: ${statusErr.message}`);
      }
      throw error;
    }
  }

  /**
   * Calculate scores for all user submissions
   */
  private async calculateUserScores(contestId: string): Promise<void> {
    try {
      logger.info(`[CONTEST SERVICE] Calculating scores for contest ${contestId}`);

      // Get questions with answers (now includes ansKey that was auto-generated)
      const questions = await this.repo.getQuestionsByContestId(contestId);
      const questionMap = new Map(questions.map((q: any) => [q.id, q]));

      logger.info(`[CONTEST SERVICE] Questions loaded: ${questions.length} questions with answers`);

      // Get all submissions for this contest
      const submissions = await this.repo.getUserSubmissionsByContestId(contestId);
      if (!submissions || submissions.length === 0) {
        logger.info(`[CONTEST SERVICE] No submissions found for contest ${contestId}`);
        return;
      }

      logger.info(`[CONTEST SERVICE] Recalculating scores for ${submissions.length} submissions`);

      // Recalculate each submission by re-evaluating answers against questions
      for (const submission of submissions) {
        try {
          let newTotalScore = 0;
          let maxScore = 0;
          const updatedAnswers: any[] = [];

          // Parse answers from submission
          const answers = Array.isArray(submission.answers) ? submission.answers : [];
          
          logger.info(`[CONTEST SERVICE] Processing submission ${submission.id}: ${answers.length} answers`);

          // Re-evaluate each answer
          for (const answer of answers) {
            const question = questionMap.get(answer.questionId);
            
            if (!question) {
              logger.warn(`[CONTEST SERVICE] Question ${answer.questionId} not found for submission ${submission.id}`);
              updatedAnswers.push({
                ...answer,
                isCorrect: false,
                earnedPoints: 0,
                note: 'question not found'
              });
              continue;
            }

            // Get the correct answer from question
            const correctAnswer = question.ansKey || question.correctKey || null;
            const questionPoints = question.points || 1;
            
            // Normalize for comparison
            const normalize = (v: any) => 
              v === null || v === undefined ? '' : String(v).trim().toLowerCase();
            
            const selectedNorm = normalize(answer.selectedKey);
            const correctNorm = normalize(correctAnswer);
            
            // Determine if answer is correct
            const isCorrect = correctNorm && selectedNorm === correctNorm;
            const earnedPoints = isCorrect ? questionPoints : 0;

            newTotalScore += earnedPoints;
            maxScore += questionPoints;

            updatedAnswers.push({
              ...answer,
              isCorrect,
              earnedPoints,
              ansKey: correctAnswer, // Include the correct answer for reference
              note: isCorrect ? 'correct' : 'incorrect'
            });

            logger.info(`[CONTEST SERVICE] Answer evaluation - Q${answer.questionId}: selected="${selectedNorm}" vs correct="${correctNorm}" = ${isCorrect ? 'CORRECT' : 'WRONG'} (${earnedPoints}/${questionPoints} points)`);
          }

          // Update submission with recalculated scores
          await DB.UserSubmission.update(
            { 
              totalScore: newTotalScore,
              maxScore: maxScore,
              answers: updatedAnswers 
            },
            { where: { id: submission.id } }
          );

          logger.info(`[CONTEST SERVICE] ✅ Updated submission ${submission.id}: ${newTotalScore}/${maxScore} points`);
        } catch (err: any) {
          logger.error(`[CONTEST SERVICE] Error calculating submission ${submission.id}: ${err?.message}`);
        }
      }

      // Update leaderboard with final rankings
      await this.updateLeaderboard(contestId);

      logger.info(`[CONTEST SERVICE] ✅ Score calculation completed for contest ${contestId}`);
    } catch (error: any) {
      logger.error(`[CONTEST SERVICE] calculateUserScores error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update contest leaderboard with final rankings
   */
  private async updateLeaderboard(contestId: string): Promise<void> {
    try {
      logger.info(`[CONTEST SERVICE] Starting leaderboard update for contest ${contestId}`);
      
      const userScores = await this.repo.getUserContestScores(contestId);
      
      if (!userScores || userScores.length === 0) {
        logger.info(`[CONTEST SERVICE] No user scores to update for contest ${contestId}`);
        return;
      }

      logger.info(`[CONTEST SERVICE] Updating leaderboard for ${userScores.length} users in contest ${contestId}`);
      
      const updatePromises = userScores.map(async (userScore) => {
        try {
          logger.info(`[CONTEST SERVICE] Updating leaderboard - User: ${userScore.userId}, Score: ${userScore.totalScore}, Rank: ${userScore.rank}`);
          await this.repo.updateUserContestScore(
            contestId,
            userScore.userId,
            userScore.totalScore,
            userScore.rank
          );
        } catch (updateErr: any) {
          logger.error(`[CONTEST SERVICE] Error updating leaderboard for user ${userScore.userId}: ${updateErr?.message}`);
        }
      });

      await Promise.all(updatePromises);
      logger.info(`[CONTEST SERVICE] ✅ Leaderboard updated for contest ${contestId} with ${userScores.length} rankings`);

      // Distribute prizes after updating leaderboard
      await this.distributePrizes(contestId);
    } catch (error: any) {
      logger.error(`[CONTEST SERVICE] updateLeaderboard error: ${error.message}`);
      logger.error(`[CONTEST SERVICE] Stack: ${error.stack}`);
      // Don't throw - allow contest to complete even if leaderboard update fails
      logger.warn(`[CONTEST SERVICE] Continuing despite leaderboard error for contest ${contestId}`);
    }
  }

  /**
   * Distribute prizes to users based on their final ranks
   */
  private async distributePrizes(contestId: string): Promise<void> {
    try {
      logger.info(`[CONTEST SERVICE] Starting prize distribution for contest ${contestId}`);

      // Get prize breakdown for this contest
      const prizeBreakdown = await this.repo.getPrizeBreakdown(contestId);
      
      if (!prizeBreakdown || prizeBreakdown.length === 0) {
        logger.info(`[CONTEST SERVICE] No prize breakdown found for contest ${contestId}, skipping prize distribution`);
        return;
      }

      logger.info(`[CONTEST SERVICE] Found ${prizeBreakdown.length} prize tiers for contest ${contestId}`);

      // Get all user contests with their ranks
      const userContests = await this.repo.getUserContestsWithRanks(contestId);
      
      if (!userContests || userContests.length === 0) {
        logger.info(`[CONTEST SERVICE] No users found for prize distribution in contest ${contestId}`);
        return;
      }

      logger.info(`[CONTEST SERVICE] Distributing prizes to ${userContests.length} users in contest ${contestId}`);

      let successCount = 0;
      let failCount = 0;

      for (const userContest of userContests) {
        try {
          const userRank = userContest.rank;
          
          if (!userRank) {
            logger.warn(`[CONTEST SERVICE] User ${userContest.userId} has no rank, skipping prize distribution`);
            continue;
          }

          // Find the prize tier for this rank
          const prizeTier = prizeBreakdown.find((prize: any) => {
            const rankFrom = prize.rankFrom || prize.rank_from;
            const rankTo = prize.rankTo || prize.rank_to;
            return userRank >= rankFrom && userRank <= rankTo;
          });

          if (!prizeTier) {
            logger.info(`[CONTEST SERVICE] No prize tier for rank ${userRank} (user ${userContest.userId})`);
            continue;
          }

          const prizeAmount = Number(prizeTier.amount);
          
          if (prizeAmount <= 0) {
            logger.info(`[CONTEST SERVICE] Zero prize amount for rank ${userRank} (user ${userContest.userId})`);
            continue;
          }

          // Credit the prize to user's wallet via wallet service
          logger.info(`[CONTEST SERVICE] Crediting ${prizeAmount} to user ${userContest.userId} for rank ${userRank}`);
          
          const walletServiceUrl = ServerConfigs.WALLET_SERVICE_URL;
          const response = await axios.post(
            `${walletServiceUrl}/api/v1/wallet/internal/credit-contest-winnings`,
            {
              userId: userContest.userId,
              amount: prizeAmount,
              contestId: contestId
            },
            {
              headers: {
                'Content-Type': 'application/json'
              },
              timeout: 10000
            }
          );

          if (response.data?.success) {
            logger.info(`[CONTEST SERVICE] ✅ Prize credited to user ${userContest.userId}: ${prizeAmount} coins for rank ${userRank}`);
            successCount++;
          } else {
            logger.error(`[CONTEST SERVICE] Failed to credit prize to user ${userContest.userId}: ${JSON.stringify(response.data)}`);
            failCount++;
          }
        } catch (creditErr: any) {
          logger.error(`[CONTEST SERVICE] Error crediting prize to user ${userContest.userId}: ${creditErr?.message}`);
          failCount++;
        }
      }

      logger.info(`[CONTEST SERVICE] ✅ Prize distribution completed for contest ${contestId}: ${successCount} success, ${failCount} failed`);
    } catch (error: any) {
      logger.error(`[CONTEST SERVICE] distributePrizes error: ${error.message}`);
      logger.error(`[CONTEST SERVICE] Stack: ${error.stack}`);
      // Don't throw - allow contest to complete even if prize distribution fails
      logger.warn(`[CONTEST SERVICE] Continuing despite prize distribution error for contest ${contestId}`);
    }
  }

  /**
   * Force complete stuck contests that are in calculating status
   * This is a manual fix for contests that failed to complete
   */
  public async forceCompleteStuckContests(matchId?: string): Promise<any> {
    try {
      logger.info(`[CONTEST SERVICE] Checking for stuck contests in calculating status`);

      // Find all contests stuck in calculating status
      const stuckContests = await this.repo.getContestsByStatus('calculating', matchId);
      
      if (!stuckContests || stuckContests.length === 0) {
        logger.info(`[CONTEST SERVICE] No stuck contests found`);
        return {
          fixed: 0,
          message: 'No stuck contests found'
        };
      }

      logger.info(`[CONTEST SERVICE] Found ${stuckContests.length} stuck contests, forcing completion`);

      let fixedCount = 0;
      const results = [];

      for (const contest of stuckContests) {
        try {
          logger.info(`[CONTEST SERVICE] Force completing contest ${contest.id} - ${contest.title}`);
          
          // Simply mark as completed (scores should already be calculated)
          await this.repo.updateContestStatus(contest.id, 'completed');
          
          fixedCount++;
          results.push({
            contestId: contest.id,
            title: contest.title,
            status: 'fixed'
          });
          
          logger.info(`[CONTEST SERVICE] ✅ Force completed contest ${contest.id}`);
        } catch (err: any) {
          logger.error(`[CONTEST SERVICE] Failed to fix contest ${contest.id}: ${err.message}`);
          results.push({
            contestId: contest.id,
            title: contest.title,
            status: 'failed',
            error: err.message
          });
        }
      }

      return {
        fixed: fixedCount,
        total: stuckContests.length,
        results
      };
    } catch (error: any) {
      logger.error(`[CONTEST SERVICE] forceCompleteStuckContests error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Move all non-completed contests to calculating status when match is completed
   * This triggers result calculation and leaderboard updates
   */
  public async moveContestsToCalculating(matchId: string): Promise<any> {
    try {
      logger.info(`[CONTEST SERVICE] Moving contests to calculating for completed match ${matchId}`);

      // Find all contests for this match that are not yet calculating/completed
      const contests = await DB.Contest.findAll({
        where: {
          matchId: matchId,
          status: {
            [Op.in]: ["upcoming", "live", "joining_closed"],
          },
        },
      });

      if (!contests || contests.length === 0) {
        logger.info(`[CONTEST SERVICE] No active contests found for match ${matchId}`);
        return {
          updated: 0,
          message: 'No active contests found for this match'
        };
      }

      logger.info(`[CONTEST SERVICE] Found ${contests.length} active contests, moving to calculating`);

      const contestIds = contests.map(c => c.id);

      // Update all to calculating status
      const [updateCount] = await DB.Contest.update(
        { status: "calculating" },
        {
          where: {
            id: {
              [Op.in]: contestIds,
            },
          },
        }
      );

      logger.info(`[CONTEST SERVICE] ✅ Moved ${updateCount} contests to calculating status`);

      return {
        updated: updateCount,
        contestIds: contestIds,
        message: `Successfully moved ${updateCount} contests to calculating status`
      };
    } catch (error: any) {
      logger.error(`[CONTEST SERVICE] moveContestsToCalculating error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Complete all contests in calculating status for a match
   * This manually triggers the calculation process for stuck contests
   */
  public async completeCalculatingContests(matchId: string): Promise<any> {
    try {
      logger.info(`[CONTEST SERVICE] Completing calculating contests for match ${matchId}`);

      // Get all contests in calculating status for this match
      const contests = await DB.Contest.findAll({
        where: {
          matchId: matchId,
          status: "calculating",
        },
      });

      if (!contests || contests.length === 0) {
        logger.info(`[CONTEST SERVICE] No contests in calculating status for match ${matchId}`);
        return {
          completed: 0,
          message: 'No contests in calculating status for this match'
        };
      }

      logger.info(`[CONTEST SERVICE] Found ${contests.length} contests in calculating status`);

      // Get match and live data
      const matchServiceUrl = process.env.MATCHES_SERVICE_URL || "http://localhost:8002";
      
      let matchData = null;
      let liveData = null;
      
      try {
        const matchResponse = await axios.get(
          `${matchServiceUrl}/api/v1/matches/${matchId}`,
          { timeout: 10000 }
        );
        matchData = matchResponse.data?.data;
      } catch (err: any) {
        logger.warn(`[CONTEST SERVICE] Could not fetch match data: ${err.message}`);
      }

      try {
        const liveResponse = await axios.get(
          `${matchServiceUrl}/api/v1/matches/${matchId}/live-score`,
          { timeout: 10000 }
        );
        liveData = liveResponse.data?.data;
      } catch (err: any) {
        logger.warn(`[CONTEST SERVICE] Could not fetch live data: ${err.message}`);
      }

      let completedCount = 0;
      const results = [];

      // Process each contest
      for (const contest of contests) {
        try {
          logger.info(`[CONTEST SERVICE] Processing contest ${contest.id} - ${contest.get('title')}`);

          const dataForCalculation = {
            match: matchData,
            live: liveData,
            ballByBallData: liveData?.ballByBallData || null,
          };

          await this.processContestCalculation(
            contest.id,
            matchId,
            dataForCalculation
          );

          completedCount++;
          results.push({
            contestId: contest.id,
            title: contest.get('title'),
            status: 'completed'
          });

          logger.info(`[CONTEST SERVICE] ✅ Completed contest ${contest.id}`);
        } catch (err: any) {
          logger.error(`[CONTEST SERVICE] Failed to complete contest ${contest.id}: ${err.message}`);
          results.push({
            contestId: contest.id,
            title: contest.get('title'),
            status: 'failed',
            error: err.message
          });
        }
      }

      return {
        completed: completedCount,
        total: contests.length,
        results
      };
    } catch (error: any) {
      logger.error(`[CONTEST SERVICE] completeCalculatingContests error: ${error.message}`);
      throw error;
    }
  }
}

