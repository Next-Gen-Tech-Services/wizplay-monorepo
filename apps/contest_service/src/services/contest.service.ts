// src/services/contest.service.ts
import { BadRequestError, logger } from "@repo/common";
import { autoInjectable } from "tsyringe";
import {
  CreateContestPayload,
  CreateQuestionPayload,
  UpdateContestPayload,
} from "../dtos/contest.dto";
import ContestRepository from "../repositories/contest.repository";

@autoInjectable()
export default class ContestService {
  constructor(private readonly repo: ContestRepository) {}

  public async createContest(payload: CreateContestPayload) {
    if (!payload.matchId) throw new BadRequestError("matchId required");
    // business rules could go here
    const created = await this.repo.createContest(payload);
    logger.info(`[contest-service] created contest ${created.id}`);
    return created;
  }

  public async listContests(matchId: string, limit = 20, offset = 0) {
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
}
