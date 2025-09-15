// src/repositories/contest.repository.ts
import { logger, ServerError } from "@repo/common";
import { DB, IDatabase } from "../configs/database.config";
import {
  CreateContestPayload,
  CreateQuestionPayload,
  UpdateContestPayload,
} from "../dtos/contest.dto";
import { Contest } from "../models/contest.model";
import { Question } from "../models/question.model";

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

  public async getContestById(id: string): Promise<Contest | null> {
    try {
      return await this._DB.Contest.findByPk(id);
    } catch (err: any) {
      logger.error(`getContestById DB error: ${err?.message ?? err}`);
      throw new ServerError("Database error");
    }
  }

  public async listContestsByMatch(matchId?: string, limit = 20, offset = 0) {
    try {
      // build where clause conditionally
      const where = matchId ? { matchId } : {};

      const { rows, count } = await this._DB.Contest.findAndCountAll({
        where,
        // include: [
        //   {
        //     model: this._DB.Match,
        //     as: "match", // adjust alias to whatever association alias you used
        //     required: false, // if you want only contests that have matches, set to true
        //     attributes: ["id", "title", "start_at", "end_at"],
        //   },
        // ],
        order: [["start_at", "ASC"]],
        limit,
        offset,
      });

      return { items: rows, total: count };
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
      const cnt = await this._DB.Contest.destroy({ where: { id } });
      return cnt > 0;
    } catch (err: any) {
      logger.error(`deleteContest DB error: ${err?.message ?? err}`);
      throw new ServerError("Database error");
    }
  }

  /* Questions */
  public async createQuestion(data: CreateQuestionPayload) {
    try {
      const created = await this._DB.Question.create(data);
      return created.toJSON() as Question;
    } catch (err: any) {
      logger.error(`createQuestion DB error: ${err?.message ?? err}`);
      throw new ServerError("Database error creating question");
    }
  }

  public async listQuestionsForContest(contestId: string) {
    try {
      const rows = await this._DB.Question.findAll({
        where: { contestId },
        order: [["created_at", "ASC"]],
      });
      return rows;
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

  public async deleteQuestion(id: string) {
    try {
      const cnt = await this._DB.Question.destroy({ where: { id } });
      return cnt > 0;
    } catch (err: any) {
      logger.error(`deleteQuestion DB error: ${err?.message ?? err}`);
      throw new ServerError("Database error");
    }
  }
}
