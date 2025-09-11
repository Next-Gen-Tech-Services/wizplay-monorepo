import { BadRequestError, logger, ServerError } from "@repo/common";
import { Op, WhereOptions } from "sequelize";
import { DB, IDatabase } from "../configs/database.config";
import { IMatchAttrs } from "../dtos/match.dto";
import { IMatchFilters } from "../interfaces/match";
import { Match } from "../models/match.model";

export default class MatchRepository {
  private _DB: IDatabase = DB;
  constructor() {
    this._DB = DB;
  }

  public async getTestData(): Promise<any> {}

  public async createBulkMatches(matchData: IMatchAttrs[]): Promise<any> {
    try {
      if (!matchData.length) {
        throw new BadRequestError("invalid matches value");
      }

      const result = await this._DB.Match.bulkCreate(matchData, {
        updateOnDuplicate: Object.keys(
          Match.getAttributes()
        ) as (keyof IMatchAttrs)[],
        conflictAttributes: ["key"],
      });
      logger.info(`Inserted bulk data inside matches`);

      return result;
    } catch (error: any) {
      logger.error(`Database Error: ${error}`);
      throw new ServerError("Database Error");
    }
  }

  public async fetchAllMatches(filters: IMatchFilters): Promise<{
    matches: any[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    try {
      // construct filters (same as your existing code)
      const where: WhereOptions = {};

      if (filters.sport) where["sport"] = filters.sport;
      if (filters.format) where["format"] = filters.format;
      if (filters.gender) where["gender"] = filters.gender;
      if (filters.status) where["status"] = filters.status;
      if (filters.tournamentKey) where["tournamentKey"] = filters.tournamentKey;
      if (filters.winner) where["winner"] = filters.winner;

      // string search (case-insensitive)
      if (filters.name) where["name"] = { [Op.iLike]: `%${filters.name}%` };
      if (filters.shortName)
        where["shortName"] = { [Op.iLike]: `%${filters.shortName}%` };
      if (filters.metricGroup)
        where["metricGroup"] = { [Op.iLike]: `%${filters.metricGroup}%` };

      // range filters
      if (filters.startedAfter || filters.startedBefore) {
        where["startedAt"] = {};
        if (filters.startedAfter)
          where["startedAt"][Op.gte] = filters.startedAfter;
        if (filters.startedBefore)
          where["startedAt"][Op.lte] = filters.startedBefore;
      }

      const limit = filters.limit ?? 20;
      const offset = filters.offset ?? 0;
      const page = Math.floor(offset / limit) + 1;

      // Use findAndCountAll for pagination metadata
      const result = await Match.findAndCountAll({
        where,
        include: [{ association: "tournaments" }],
        order: [["startedAt", "DESC"]],
        limit,
        offset,
      });

      const totalPages = Math.ceil(result.count / limit);

      return {
        matches: result.rows,
        pagination: {
          total: result.count,
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      logger.error(`Database Error: ${error}`);
      throw new ServerError("Database Error");
    }
  }
}
