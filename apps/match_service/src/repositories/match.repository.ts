import { BadRequestError, logger, ServerError } from "@repo/common";
import { DB, IDatabase } from "../configs/database.config";
import { IMatchAttrs } from "../dtos/match.dto";
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
}
