import { BadRequestError, logger, ServerError } from "@repo/common";
import { Op, QueryTypes, WhereOptions } from "sequelize";
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
        return plain;
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
