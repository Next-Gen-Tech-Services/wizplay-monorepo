import { logger } from "@repo/common";
import { Transaction } from "sequelize";
import { DB } from "../configs/database.config";

export default class UserSubmissionRepository {
  private _DB = DB;
  constructor() {}

  public async create(payload: any, options?: { transaction?: Transaction }) {
    try {
      const row = await this._DB.UserSubmission.create(payload, {
        transaction: options?.transaction,
      });
      return row;
    } catch (err: any) {
      logger.error(
        `UserSubmissionRepository.create error: ${err?.message ?? err}`
      );
      throw err;
    }
  }

  public async listByUser(userId: string, limit = 50, offset = 0) {
    try {
      return await this._DB.UserSubmission.findAll({
        where: { userId },
        order: [["created_at", "DESC"]],
        limit,
        offset,
      });
    } catch (err: any) {
      logger.error(
        `UserSubmissionRepository.listByUser error: ${err?.message ?? err}`
      );
      throw err;
    }
  }

  public async findById(id: string) {
    try {
      return await this._DB.UserSubmission.findByPk(id);
    } catch (err: any) {
      logger.error(
        `UserSubmissionRepository.findById error: ${err?.message ?? err}`
      );
      throw err;
    }
  }

   public async findByContestId(contestId: string) {
    try {
      return await this._DB.UserSubmission.findAll({
        where: { contestId },
      });
    } catch (err: any) {
      logger.error(
        `UserSubmissionRepository.findByContestId error: ${err?.message ?? err}`
      );
      throw err;
    }
  }

  public async findByUserId(userId: string) {
    try {
      return await this._DB.UserSubmission.findAll({
        where: { userId },
      });
    } catch (err: any) {
      logger.error(
        `UserSubmissionRepository.findByUserId error: ${err?.message ?? err}`
      );
      throw err;
    }
  }

  // New
  public async findContestSubmissionById(userId: string, contestId: string) {
    try {
      // 1) load submission as plain object
      const submissionInstance = await this._DB.UserSubmission.findOne({
        where: { contestId, userId },
      });

      if (!submissionInstance) return null;

      const submission = submissionInstance.toJSON() as any;
      const answers: any[] = Array.isArray(submission.answers)
        ? submission.answers
        : [];

      // 2) gather questionIds from answers
      const questionIds = Array.from(
        new Set(answers.map((a) => a.questionId).filter((id) => !!id))
      );

      if (questionIds.length === 0) {
        // nothing to enrich — return submission as-is
        return submission;
      }

      // 3) fetch questions from DB (pick only the fields you want)
      const questions = await this._DB.Question.findAll({
        where: { id: questionIds },
        attributes: ["id", "question", "options", "ansKey"], // adjust to your model
        raw: true,
      });

      // 4) create a lookup map
      const qById: Record<string, any> = {};
      for (const q of questions) qById[q.id] = q;

      // 5) enrich answers by flattening question fields into each answer
      const enrichedAnswers = answers.map((ans) => {
        const q = qById[ans.questionId] ?? null;

        // pick which question fields to flatten — change/remove as needed
        const flattenedQuestionFields: Record<string, any> = {};
        if (q) {
          // example fields flattened:
          flattenedQuestionFields.question = q.question ?? null;
          flattenedQuestionFields.options = q.options ?? null;
          flattenedQuestionFields.ansKey = q.ansKey ?? null;
        }

        return {
          ...ans,
          ...flattenedQuestionFields,
        };
      });

      // 6) return enriched submission object (questions array optional — not included here)
      return {
        ...submission,
        answers: enrichedAnswers,
      };
    } catch (err: any) {
      logger.error(
        `UserSubmissionRepository.findContestSubmissionById error: ${err?.message ?? err}`
      );
      throw err;
    }
  }
}
