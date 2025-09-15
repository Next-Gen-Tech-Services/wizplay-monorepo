// src/services/contest.service.ts
import { BadRequestError, logger, ServerError } from "@repo/common";
import { autoInjectable } from "tsyringe";
import {
  CreateContestPayload,
  CreateQuestionPayload,
  UpdateContestPayload,
} from "../dtos/contest.dto";
import ContestRepository from "../repositories/contest.repository";
import { GenerativeAi } from "../utils/generativeAi";
import { formatQuestions } from "../utils/questionsFormatter";

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

  /* Questions */
  public async createQuestion(payload: CreateQuestionPayload) {
    // validate
    if (!payload.contestId) throw new BadRequestError("contestId required");
    if (!payload.options || payload.options.length < 2)
      throw new BadRequestError("Options required");
    if (
      payload.correctIndex < 0 ||
      payload.correctIndex >= payload.options.length
    )
      throw new BadRequestError("correctIndex invalid");
    const q = await this.repo.createQuestion(payload);
    return q;
  }

  public async listQuestions(contestId: string) {
    return this.repo.listQuestionsForContest(contestId);
  }

  public async getQuestion(id: string) {
    const q = await this.repo.getQuestionById(id);
    if (!q) throw new BadRequestError("Question not found");
    return q;
  }

  public async deleteQuestion(id: string) {
    return this.repo.deleteQuestion(id);
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
}
