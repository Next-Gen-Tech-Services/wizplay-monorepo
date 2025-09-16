// src/services/contest.service.ts
import { BadRequestError, logger, ServerError } from "@repo/common";
import { autoInjectable } from "tsyringe";
import {
  CreateContestPayload,
  UpdateContestPayload,
} from "../dtos/contest.dto";
import ContestRepository from "../repositories/contest.repository";
import { KAFKA_EVENTS } from "../types";
import { GenerativeAi } from "../utils/generativeAi";
import { publishUserEvent } from "../utils/kafka";
import {
  formatContestsForBulkInsert,
  formatQuestions,
  formatQuestionsForBulkInsert,
} from "../utils/questionsFormatter";

@autoInjectable()
export default class ContestService {
  private generativeAI: GenerativeAi;
  constructor(private readonly repo: ContestRepository) {
    this.generativeAI = new GenerativeAi();
  }

  public async createContest(payload: CreateContestPayload) {
    if (!payload.matchId) throw new BadRequestError("matchId required");
    // business rules could go here
    const created = await this.repo.createContest(payload);
    logger.info(`[contest-service] created contest ${created.id}`);
    return created;
  }

  public async listContests(matchId?: string, limit = 20, offset = 0) {
    // pass through to repository
    return this.repo.listContestsByMatch(matchId, limit, offset);
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
}
