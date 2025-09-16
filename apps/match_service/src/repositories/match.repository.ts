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
      if (filters.showOnFrontend)
        where["showOnFrontend"] = Boolean(filters.showOnFrontend);

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

  public async updateMatch(
    matchId: string,
    showOnFrontend: boolean
  ): Promise<any> {
    try {
      if (!matchId) {
        throw new ServerError("Missing match id");
      }

      const match = await this._DB.Match.update(
        {
          showOnFrontend: showOnFrontend,
        },
        {
          where: {
            id: matchId,
          },
          returning: true,
        }
      );
      return match;
    } catch (error: any) {
      logger.error(
        `match.repository.updateMatch DB error: ${error?.message ?? error}`
      );
      // bubble as ServerError for upper layers
      throw new ServerError(
        error?.message || "Database error while updating match"
      );
    }
  }

  public async updateGeneratedStatus(
    matchId: string,
    data: { contestGenerated: boolean }
  ): Promise<any> {
    try {
      if (!matchId) {
        throw new ServerError("Missing match id");
      }

      const match = await this._DB.Match.update(
        {
          ...data,
        },
        {
          where: {
            id: matchId,
          },
          returning: true,
        }
      );
      return match;
    } catch (error: any) {
      logger.error(
        `match.repository.updateMatch DB error: ${error?.message ?? error}`
      );
      // bubble as ServerError for upper layers
      throw new ServerError(
        error?.message || "Database error while updating match"
      );
    }
  }

  public async getMatchWithId(matchId: string): Promise<any> {
    try {
      if (!matchId) {
        throw new BadRequestError("invalid match id");
      }

      const matchData = await this._DB.Match.findOne({
        where: {
          key: matchId,
        },
        include: [{ association: "tournaments" }],
      });

      return matchData;
    } catch (error: any) {
      logger.error(error.message);
    }
  }

  public async addToWishlist(userId: string, matchId: string): Promise<any> {
    try {
      if (!userId || !matchId) {
        throw new BadRequestError("invalid user id or match id");
      }
      const wishlistEntry = await this._DB.Wishlist.create({
        userId,
        matchId,
      });
      return wishlistEntry;
    } catch (error: any) {
      logger.error(error.message);
    }
  }
}
