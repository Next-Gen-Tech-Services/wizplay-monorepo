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

  public async getContest(id: string) {
    const c = await this.repo.getContestById(id);
    if (!c) throw new BadRequestError("Contest not found");
    return c;
  }

  public async updateContest(id: string, patch: UpdateContestPayload) {
    return this.repo.updateContest(id, patch);
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

      // 4) check existing active join
      const existing = await this.userContestRepo!.findActiveJoin(
        userId,
        contestId,
        { transaction: tx }
      );
      if (existing) {
        await tx.rollback();
        const e = new Error("User already joined this contest");
        (e as any).code = "CONFLICT";
        throw e;
      }

      // 5) deduct wallet balance (if entryFee > 0)
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

      // 6) create join row
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

      // 7) increment filled spots atomically
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
}
