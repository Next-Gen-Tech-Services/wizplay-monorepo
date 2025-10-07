// src/repositories/contest.repository.ts
import { logger, ServerError } from "@repo/common";
import { Transaction } from "sequelize";
import { DB, IDatabase } from "../configs/database.config";
import { IQuestionAttrs, Question } from "../models/question.model";

export default class QuestionRepository {
  private _DB: IDatabase = DB;

  constructor() {
    this._DB = DB;
  }

  public async createQuestion(data: any) {
    try {
      const created = await this._DB.Question.create(data);
      return created.toJSON() as Question;
    } catch (err: any) {
      logger.error(`createQuestion DB error: ${err?.message ?? err}`);
      throw new ServerError("Database error creating question");
    }
  }

  public async listQuestionsForContest(
    contestId?: string,
    limit = 20,
    offset = 0
  ) {
    try {
      const where = contestId ? { contestId } : {};

      // Use distinct + col to ensure COUNT(DISTINCT "Contest"."id") so joins don't inflate counts.
      const result = await this._DB.Question.findAndCountAll({
        where,
        limit,
        offset,
        distinct: true,
      });

      // Normalize count (Sequelize returns number OR array if grouped)
      let total: number;
      if (Array.isArray(result.count)) {
        // try to sum counts if array of objects, otherwise fallback to length
        try {
          total = result.count.reduce((acc: number, cur: any) => {
            if (typeof cur === "number") return acc + cur;
            if (cur && typeof cur === "object") {
              const c = "count" in cur ? Number((cur as any).count) : NaN;
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

      return { items: result.rows, total };
    } catch (err: any) {
      logger.error(`listQuestionsForContest DB error: ${err?.message ?? err}`);
      throw new ServerError("Database error");
    }
  }

  public async getQuestionById(id: string) {
    try {
      return await this._DB.Question.findByPk(id);
    } catch (err: any) {
      logger.error(`getQuestionById DB error: ${err?.message ?? err}`);
      throw new ServerError("Database error");
    }
  }

  public async updateQuestion(id: string, updates: Partial<IQuestionAttrs>) {
    try {
      const [affected, rows] = await this._DB.Question.update(updates, {
        where: { id },
        returning: true,
      });
      return affected > 0 ? (rows[0].toJSON() as Question) : null;
    } catch (err: any) {
      logger.error(`updateQuestion DB error: ${err?.message ?? err}`);
      throw new ServerError("Database error updating question");
    }
  }

  public async deleteQuestion(id: string) {
    try {
      const cnt = await this._DB.Question.destroy({ where: { id } });
      return cnt > 0;
    } catch (err: any) {
      logger.error(`deleteQuestion DB error: ${err?.message ?? err}`);
      throw new ServerError("Database error");
    }
  }

  public async findByIds(
    ids: string[],
    options?: { transaction?: Transaction }
  ) {
    try {
      return await this._DB.Question.findAll({
        where: { id: ids },
        transaction: options?.transaction,
      });
    } catch (err: any) {
      logger.error(
        `QuestionRepository.findByIds error: ${err?.message ?? err}`
      );
      throw err;
    }
  }

  public async findByContest(
    contestId: string,
    options?: { transaction?: Transaction }
  ) {
    try {
      return await this._DB.Question.findAll({
        where: { contestId },
        transaction: options?.transaction,
      });
    } catch (err: any) {
      logger.error(
        `QuestionRepository.findByContest error: ${err?.message ?? err}`
      );
      throw err;
    }
  }
}
