import { BadRequestError, logger, ServerError } from "@repo/common";
import { Op, QueryTypes, WhereOptions } from "sequelize";
import { DB, IDatabase } from "../configs/database.config";
import { IMatchAttrs } from "../dtos/match.dto";
import { IMatchFilters } from "../interfaces/match";
import { Match } from "../models/match.model";
import ServerConfigs from "../configs/server.config";

/**
 * Add team flag URLs to match data based on country codes
 * Uses locally stored flags downloaded from Roanuz API
 */
function addTeamFlags(matchData: any): any {
  if (matchData && matchData.teams) {
    const baseUrl = ServerConfigs.ASSET_SERVICE_URL;

    if (matchData.teams.a && matchData.teams.a.country_code) {
      matchData.teams.a.flag_url = `${baseUrl}api/v1/matches/flags/${matchData.teams.a.country_code.toLowerCase()}.svg`;
    }
    if (matchData.teams.b && matchData.teams.b.country_code) {
      matchData.teams.b.flag_url = `${baseUrl}api/v1/matches/flags/${matchData.teams.b.country_code.toLowerCase()}.svg`;
    }
  }
  return matchData;
}

export default class MatchRepository {
  private _DB: IDatabase = DB;
  constructor() {
    this._DB = DB;
  }

  public async getTestData(): Promise<any> { }

  public async createBulkMatches(matchData: IMatchAttrs[]): Promise<any> {
    try {
      if (!matchData.length) {
        throw new BadRequestError("invalid matches value");
      }

      // Only update fields that come from the API, preserve internal fields
      const fieldsToUpdate: (keyof IMatchAttrs)[] = [
        "sport",
        "format",
        "gender",
        "tournamentKey",
        "name",
        "shortName",
        "status",
        "metricGroup",
        "winner",
        "subTitle",
        "startedAt",
        "endedAt",
        "expectedStartedAt",
        "expectedEndedAt",
        "teams",
        "updatedAt", // Always update timestamp
      ];

      const result = await this._DB.Match.bulkCreate(matchData, {
        updateOnDuplicate: fieldsToUpdate,
        conflictAttributes: ["key"],
      });
      logger.info(`Inserted/Updated ${result.length} matches in bulk`);

      return result;
    } catch (error: any) {
      logger.error(`Database Error: ${error}`);
      throw new ServerError("Database Error");
    }
  }

  public async fetchAllMatches(
    filters: IMatchFilters,
    currentUserId?: string
  ): Promise<{
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
      const where: WhereOptions = {};
      if (filters.sport) where["sport"] = filters.sport;
      if (filters.format) where["format"] = filters.format;
      if (filters.gender) where["gender"] = filters.gender;
      if (filters.status) where["status"] = filters.status;
      if (filters.tournamentKey) where["tournamentKey"] = filters.tournamentKey;
      if (filters.winner) where["winner"] = filters.winner;
      if (
        filters.showOnFrontend !== undefined &&
        filters.showOnFrontend !== null
      )
        where["showOnFrontend"] = Boolean(filters.showOnFrontend);
      if (filters.name) where["name"] = { [Op.iLike]: `%${filters.name}%` };
      if (filters.shortName)
        where["shortName"] = { [Op.iLike]: `%${filters.shortName}%` };
      if (filters.metricGroup)
        where["metricGroup"] = { [Op.iLike]: `%${filters.metricGroup}%` };
      if (filters.teamName)
        (where as any)[Op.or] = [
          { homeTeamName: { [Op.iLike]: `%${filters.teamName}%` } },
          { awayTeamName: { [Op.iLike]: `%${filters.teamName}%` } },
        ];
      if (filters.startedAfter || filters.startedBefore) {
        where["started_at"] = {};
        if (filters.startedAfter)
          (where["started_at"] as any)[Op.gte] = filters.startedAfter;
        if (filters.startedBefore)
          (where["started_at"] as any)[Op.lte] = filters.startedBefore;
      }

      const limit = Number(filters.limit ?? 20);
      const offset = Number(filters.offset ?? 0);
      const page = Math.max(1, Math.floor(offset / limit) + 1);

      const attributes: any = { include: [] };
      const include: any[] = [{ association: "tournaments" }];

      if (currentUserId) {
        const escapedUserId = this._DB.sequelize.escape(currentUserId);
        attributes.include.push([
          this._DB.sequelize.literal(`(
          SELECT CASE WHEN COUNT(*) > 0 THEN true ELSE false END
          FROM "wishlists"
          WHERE "wishlists"."match_id" = "Match"."id"
            AND "wishlists"."user_id" = ${escapedUserId}
        )`),
          "wishlisted",
        ]);
      } else {
        attributes.include.push([
          this._DB.sequelize.literal(`false`),
          "wishlisted",
        ]);
      }

      const now = new Date();
      const startOfTodayDt = new Date(now);
      startOfTodayDt.setHours(0, 0, 0, 0);
      const startOfTomorrowDt = new Date(startOfTodayDt);
      startOfTomorrowDt.setDate(startOfTomorrowDt.getDate() + 1);
      const endOfTomorrowDt = new Date(startOfTodayDt);
      endOfTomorrowDt.setDate(endOfTomorrowDt.getDate() + 2);

      const startOfTodayEpoch = Math.floor(startOfTodayDt.getTime() / 1000);
      const startOfTomorrowEpoch = Math.floor(
        startOfTomorrowDt.getTime() / 1000
      );
      const endOfTomorrowEpoch = Math.floor(endOfTomorrowDt.getTime() / 1000);
      const escCompleted = this._DB.sequelize.escape("completed");

      const order: any = [
        [
          this._DB.sequelize.literal(`CASE
          WHEN "started_at" >= ${startOfTodayEpoch} AND "started_at" < ${endOfTomorrowEpoch} AND "status" != ${escCompleted} THEN 0
          WHEN "started_at" >= ${startOfTodayEpoch} AND "started_at" < ${endOfTomorrowEpoch} AND "status" = ${escCompleted} THEN 1
          ELSE 2 END`),
          "ASC",
        ],
        [
          this._DB.sequelize.literal(`CASE
          WHEN "status" = ${escCompleted} THEN -("started_at")
          ELSE "started_at" END`),
          "ASC",
        ],
      ];

      const result = await Match.findAndCountAll({
        where,
        include,
        attributes,
        order,
        limit,
        offset,
        distinct: true,
      });

      const total = Number(result.count ?? 0);
      const totalPages = Math.max(1, Math.ceil(total / limit));

      const matches = result.rows.map((r: any) => {
        const plain = r.get ? r.get({ plain: true }) : r;
        plain.wishlisted =
          plain.wishlisted === "t" || plain.wishlisted === "1"
            ? true
            : Boolean(plain.wishlisted);
        if (plain.wishlists !== undefined) delete plain.wishlists;

        // Add team flag URLs
        return addTeamFlags(plain);
      });

      return {
        matches,
        pagination: {
          total,
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

      if (matchData) {
        const plain = matchData.get({ plain: true });
        return addTeamFlags(plain);
      }

      return matchData;
    } catch (error: any) {
      logger.error(error.message);
    }
  }

  public async getMatchById(matchId: string): Promise<any> {
    try {
      if (!matchId) {
        throw new BadRequestError("invalid match id");
      }

      const matchData = await this._DB.Match.findOne({
        where: {
          id: matchId,
        },
        include: [{ association: "tournaments" }],
      });

      if (matchData) {
        const plain = matchData.get({ plain: true });
        return addTeamFlags(plain);
      }

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

  public async removeFromWishlist(userId: string, matchId: string): Promise<number> {
    try {
      if (!userId || !matchId) {
        throw new BadRequestError("invalid user id or match id");
      }
      const deletedRows = await this._DB.Wishlist.destroy({
        where: {
          userId,
          matchId,
        },
      });
      return deletedRows;
    } catch (error: any) {
      logger.error(`Error removing from wishlist: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all active matches (not completed or cancelled)
   */
  public async getActiveMatches(): Promise<Match[]> {
    try {
      const matches = await this._DB.Match.findAll({
        where: {
          status: {
            [Op.notIn]: ["completed", "cancelled", "abandoned"],
          },
        },
        order: [["startedAt", "ASC"]],
      });
      return matches;
    } catch (error: any) {
      logger.error(`Error fetching active matches: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fetch match data from Roanuz API
   */
  public async fetchMatchFromRoanuz(matchKey: string): Promise<any> {
    try {
      // TODO: Implement actual Roanuz API call
      // This is a placeholder - you'll need to implement the actual API call
      logger.info(`Fetching match ${matchKey} from Roanuz API`);
      
      // Example API call structure:
      // const response = await axios.get(`${ROANUZ_API_URL}/matches/${matchKey}`, {
      //   headers: {
      //     'Authorization': `Bearer ${ROANUZ_API_KEY}`
      //   }
      // });
      // return response.data;
      
      return null; // Replace with actual API response
    } catch (error: any) {
      logger.error(`Error fetching match from Roanuz: ${error.message}`);
      return null;
    }
  }

  /**
   * Update match status
   */
  public async updateMatchStatus(
    matchId: string,
    data: {
      status: string;
      winner?: string;
      startedAt?: number;
      endedAt?: number;
    }
  ): Promise<Match | null> {
    try {
      const match = await this._DB.Match.findByPk(matchId);
      if (!match) {
        logger.warn(`Match ${matchId} not found for status update`);
        return null;
      }

      await match.update(data);
      logger.info(`Updated match ${matchId} status to ${data.status}`);
      return match;
    } catch (error: any) {
      logger.error(`Error updating match status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update live match data
   */
  public async updateLiveData(matchId: string, liveData: any): Promise<any> {
    try {
      // Store live data in a JSONB column or separate table
      const match = await this._DB.Match.findByPk(matchId);
      if (!match) {
        return null;
      }

      // You might want to add a liveData column to the Match model
      // For now, we'll just log it
      logger.debug(`Live data updated for match ${matchId}`);
      
      // TODO: Store live data in database
      // await match.update({ liveData });
      
      return match;
    } catch (error: any) {
      logger.error(`Error updating live data: ${error.message}`);
      throw error;
    }
  }
}
