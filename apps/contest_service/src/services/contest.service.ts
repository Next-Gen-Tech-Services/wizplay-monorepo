// src/services/contest.service.ts
import { BadRequestError, logger, ServerError } from "@repo/common";
import { Transaction } from "sequelize";
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

export interface JoinContestPayload {
  userId: string;
  contestId: string;
  matchId?: string | null;
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

  public async listContests(matchId?: string, limit = 20, offset = 0, userId) {
    // pass through to repository
    return this.repo.listContestsByMatch(matchId, limit, offset, userId);
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
        JSON.stringify(matchData)
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
        });
        logger.debug("generate contest event published");
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
    const { userId, contestId, matchId } = payload;

    let tx: Transaction | null = null;
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

      // 2) eligibility checks
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

      // 5) create join row
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

      // 6) increment filled spots atomically
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
}
