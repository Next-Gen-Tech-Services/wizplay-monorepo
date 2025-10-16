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

  public async findContestSubmissionById(userId: string, id: string) {
    try {
      return await this._DB.UserSubmission.findOne({
        where: { contestId: id, userId },
        include: [
          {
            model: this._DB.Question,
            as: "question",
            attributes: ["id", "question"], // or "questionText"
          },
        ],
      });
    } catch (err: any) {
      logger.error(
        `UserSubmissionRepository.findContestSubmissionById error: ${err?.message ?? err}`
      );
      throw err;
    }
  }
}
