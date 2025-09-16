// src/services/contest.service.ts
import { BadRequestError } from "@repo/common";
import { autoInjectable } from "tsyringe";

import { CreateQuestionPayload } from "../dtos/question.dto";
import QuestionRepository from "../repositories/question.repository";

@autoInjectable()
export default class QuestionService {
  constructor(private readonly questionRepository: QuestionRepository) {}

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
    const q = await this.questionRepository.createQuestion(payload);
    return q;
  }

  // service.ts (replace existing listQuestions method)
  public async listQuestions(
    contestId?: string,
    limit?: number,
    offset?: number
  ) {
    // forward to repository; repository returns { items, total }
    return this.questionRepository.listQuestionsForContest(
      contestId,
      limit,
      offset
    );
  }

  public async getQuestion(id: string) {
    const q = await this.questionRepository.getQuestionById(id);
    if (!q) throw new BadRequestError("Question not found");
    return q;
  }

  public async deleteQuestion(id: string) {
    return this.questionRepository.deleteQuestion(id);
  }
}
