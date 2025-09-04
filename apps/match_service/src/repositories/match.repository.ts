import { Match } from "@/models/match.model";
import { MatchListQuery } from "@/types/subscription.type";
import { logger, ServerError } from "@repo/common";
import { Op } from "sequelize";
import { DB, IDatabase } from "../configs/database.config";

export default class MatchRepository {
  private _DB: IDatabase = DB;
  constructor() {
    this._DB = DB;
  }

  public async list(query: MatchListQuery) {
    try {
      const {
        status,
        tournament_key,
        team,
        from,
        to,
        limit = "50",
        offset = "0",
        sort = "start_at",
      } = query;

      const where: any = {};

      if (status) where.status = status;
      if (tournament_key) where.tournament_key = tournament_key;

      if (team) {
        const like = { [Op.iLike]: `%${team}%` };
        where[Op.or] = [{ team_a: like }, { team_b: like }];
      }

      if (from || to) {
        where.start_at = {};
        if (from) where.start_at[Op.gte] = new Date(Number(from) * 1000);
        if (to) where.start_at[Op.lte] = new Date(Number(to) * 1000);
      }

      const order: any[] = [];
      if (sort === "start_at" || sort === "-start_at") {
        order.push(["start_at", sort.startsWith("-") ? "DESC" : "ASC"]);
      } else {
        order.push(["start_at", "ASC"]);
      }

      const { count, rows } = await this._DB.Match.findAndCountAll({
        where,
        limit: Math.min(200, Math.max(1, Number(limit) || 50)),
        offset: Math.max(0, Number(offset) || 0),
        order,
      });

      return { count, rows };
    } catch (error: any) {
      logger.error(`Database Error (MatchRepository.list): ${error}`);
      throw new ServerError("Database Error");
    }
  }

  public async findByKey(match_key: string): Promise<Match | null> {
    try {
      return await this._DB.Match.findOne({ where: { match_key } });
    } catch (error: any) {
      logger.error(`Database Error (MatchRepository.findByKey): ${error}`);
      throw new ServerError("Database Error");
    }
  }
}
