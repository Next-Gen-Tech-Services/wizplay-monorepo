import { BadRequestError, logger, ServerError } from "@repo/common";
import { Op, QueryTypes, WhereOptions } from "sequelize";
import { DB, IDatabase } from "../configs/database.config";
import { IMatchAttrs } from "../dtos/match.dto";
import { IMatchFilters } from "../interfaces/match";
import { Match } from "../models/match.model";
import ServerConfigs from "../configs/server.config";

/**
 * Add simple team flag URLs based on team keys
 * Constructs URLs as: baseUrl + api/v1/matches/flags/ + teamKey + .png
 */
function addTeamFlags(matchData: any): any {
  if (matchData && matchData.teams && ServerConfigs.ASSET_SERVICE_URL) {
    const baseUrl = ServerConfigs.ASSET_SERVICE_URL;

    if (matchData.teams.a && matchData.teams.a.key) {
      matchData.teams.a.flag_url = `${baseUrl}api/v1/matches/flags/${matchData.teams.a.key}.png`;
    }

    if (matchData.teams.b && matchData.teams.b.key) {
      matchData.teams.b.flag_url = `${baseUrl}api/v1/matches/flags/${matchData.teams.b.key}.png`;
    }
  }
  return matchData;
}

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

      // Handle status filter: if not "all", filter for not-started and started statuses
      if (filters.status) {
        if (filters.status !== "all") {
          where["status"] = filters.status;
        }
      } else {
        where["status"] = { [Op.in]: ["not_started", "started"] };
      }

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

      // Date filter: Filter matches on a specific date (YYYY-MM-DD)
      if (filters.date) {
        try {
          const filterDate = new Date(filters.date);
          const startOfDay = new Date(filterDate);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(filterDate);
          endOfDay.setHours(23, 59, 59, 999);

          const startEpoch = Math.floor(startOfDay.getTime() / 1000);
          const endEpoch = Math.floor(endOfDay.getTime() / 1000);

          where["started_at"] = {
            [Op.gte]: startEpoch,
            [Op.lte]: endEpoch,
          };
        } catch (error) {
          logger.warn(`Invalid date filter: ${filters.date}`);
        }
      } else if (filters.startedAfter || filters.startedBefore) {
        where["started_at"] = {};
        if (filters.startedAfter)
          (where["started_at"] as any)[Op.gte] = filters.startedAfter;
        if (filters.startedBefore)
          (where["started_at"] as any)[Op.lte] = filters.startedBefore;
      }

      // Search filter: Search across name, shortName, and tournament data
      if (filters.search) {
        const searchTerm = `%${filters.search}%`;
        (where as any)[Op.or] = [
          { name: { [Op.iLike]: searchTerm } },
          { shortName: { [Op.iLike]: searchTerm } },
          { metricGroup: { [Op.iLike]: searchTerm } },
          { tournamentKey: { [Op.iLike]: searchTerm } },
        ];
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
      const escStarted = this._DB.sequelize.escape("started");
      const escCompleted = this._DB.sequelize.escape("completed");

      const order: any = [
        // First priority: Status order (started first)
        [
          this._DB.sequelize.literal(`CASE
          WHEN "status" = ${escStarted} THEN 0
          WHEN "status" = 'not_started' THEN 1
          WHEN "status" = ${escCompleted} THEN 2
          ELSE 3 END`),
          "ASC",
        ],
        // Second priority: Time-based ordering
        [
          this._DB.sequelize.literal(`CASE
          WHEN "started_at" >= ${startOfTodayEpoch} AND "started_at" < ${endOfTomorrowEpoch} THEN 0
          ELSE 1 END`),
          "ASC",
        ],
        // Third priority: Sort by start time
        ["started_at", "ASC"],
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
        const matchWithFlags = addTeamFlags(plain);

        return matchWithFlags;
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
    updateData: { showOnFrontend?: boolean; contestGenerated?: boolean }
  ): Promise<any> {
    try {
      if (!matchId) {
        throw new ServerError("Missing match id");
      }

      // Filter out undefined values
      const dataToUpdate: any = {};
      if (updateData.showOnFrontend !== undefined) {
        dataToUpdate.showOnFrontend = updateData.showOnFrontend;
      }
      if (updateData.contestGenerated !== undefined) {
        dataToUpdate.contestGenerated = updateData.contestGenerated;
      }

      const match = await this._DB.Match.update(
        dataToUpdate,
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

  public async updateMatchStatus(
    matchKey: string,
    data: {
      status?: string;
      winner?: string | null;
      endedAt?: number | null;
      startedAt?: number;
    }
  ): Promise<any> {
    try {
      if (!matchKey) {
        throw new ServerError("Missing match key");
      }

      // Build update object with only provided fields
      const updateData: any = {};
      if (data.status !== undefined) updateData.status = data.status;
      if (data.winner !== undefined) updateData.winner = data.winner;
      if (data.endedAt !== undefined) updateData.endedAt = data.endedAt;
      if (data.startedAt !== undefined) updateData.startedAt = data.startedAt;

      const [affectedCount, updatedMatches] = await this._DB.Match.update(
        updateData,
        {
          where: {
            key: matchKey,
          },
          returning: true,
        }
      );

      if (affectedCount === 0) {
        throw new BadRequestError(`Match not found with key: ${matchKey}`);
      }

      logger.info(
        `Updated match status for ${matchKey}: ${JSON.stringify(updateData)}`
      );

      return updatedMatches[0];
    } catch (error: any) {
      logger.error(
        `match.repository.updateMatchStatus DB error: ${error?.message ?? error}`
      );
      throw new ServerError(
        error?.message || "Database error while updating match status"
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

  public async getMatchIdByKey(matchKey: string): Promise<string | null> {
    try {
      if (!matchKey) {
        return null;
      }

      const matchData = await this._DB.Match.findOne({
        where: { key: matchKey },
        attributes: ["id"],
        raw: true,
      });

      return matchData?.id || null;
    } catch (error: any) {
      logger.error(`getMatchIdByKey error: ${error.message}`);
      return null;
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

  public async removeFromWishlist(
    userId: string,
    matchId: string
  ): Promise<number> {
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
}
