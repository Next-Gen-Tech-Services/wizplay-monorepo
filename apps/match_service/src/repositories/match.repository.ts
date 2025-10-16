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
      // ---------- build where ----------
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

      if (filters.startedAfter || filters.startedBefore) {
        where["startedAt"] = {};
        if (filters.startedAfter)
          (where["startedAt"] as any)[Op.gte] = filters.startedAfter;
        if (filters.startedBefore)
          (where["startedAt"] as any)[Op.lte] = filters.startedBefore;
      }

      // ---------- pagination ----------
      const limit = Number(filters.limit ?? 20);
      const offset = Number(filters.offset ?? 0);
      const page = Math.max(1, Math.floor(offset / limit) + 1);

      // ---------- attributes & includes ----------
      const attributes: any = { include: [] };
      const include: any[] = [{ association: "tournaments" }];

      if (currentUserId) {
        // escape user id to avoid injection when interpolating into literal
        const escapedUserId = this._DB.sequelize.escape(currentUserId);

        // Add wishlisted boolean via subquery literal
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
        // if no user, always false
        attributes.include.push([
          this._DB.sequelize.literal(`false`),
          "wishlisted",
        ]);
      }

      // ---------- Query ----------
      const result = await Match.findAndCountAll({
        where,
        include,
        attributes,
        order: [["startedAt", "DESC"]],
        limit,
        offset,
        distinct: true, // important for correct count when using include
      });

      const total = Number(result.count ?? 0);
      const totalPages = Math.max(1, Math.ceil(total / limit));

      // convert to plain objects and normalize wishlisted to boolean
      const matches = result.rows.map((r: any) => {
        const plain = r.get ? r.get({ plain: true }) : r;
        // sometimes sequelize returns 't'/'f' or 1/0 depending on dialect, normalize:
        if (plain.wishlisted === "t" || plain.wishlisted === "1") {
          plain.wishlisted = true;
        } else {
          plain.wishlisted = Boolean(plain.wishlisted);
        }
        // remove wishlist include rows if present to keep response tidy
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

  public async markMatchesNotInListAsFinished(
    fetchedKeys: string[],
    cutoffDate: Date
  ): Promise<any> {
    try {
      const cutoff = Math.floor(cutoffDate.getTime() / 1000); // convert to epoch seconds
      const keysToExclude =
        fetchedKeys && fetchedKeys.length ? fetchedKeys : [];

      if (keysToExclude.length) {
        const query = `
        UPDATE "${this._DB.Match.tableName}"
        SET status = :finishedStatus, updated_at = NOW()
        WHERE "started_at" < :cutoff
          AND "key" NOT IN (:keys)
          AND "status" NOT IN (:skipStatuses)
      `;
        return await this._DB.sequelize.query(query, {
          replacements: {
            finishedStatus: "finished",
            cutoff,
            keys: keysToExclude,
            skipStatuses: ["finished", "cancelled"],
          },
          type: QueryTypes.UPDATE,
        });
      } else {
        const query = `
        UPDATE "${this._DB.Match.tableName}"
        SET status = :finishedStatus, updated_at = NOW()
        WHERE "started_at" < :cutoff
          AND "status" NOT IN (:skipStatuses)
      `;
        return await this._DB.sequelize.query(query, {
          replacements: {
            finishedStatus: "finished",
            cutoff,
            skipStatuses: ["finished", "cancelled"],
          },
          type: QueryTypes.UPDATE,
        });
      }
    } catch (error: any) {
      logger.error(`Database Error (markMatchesNotInListAsFinished): ${error}`);
      throw error;
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
