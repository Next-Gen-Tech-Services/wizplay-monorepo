import { BadRequestError, logger, ServerError } from "@repo/common";
import { DB, IDatabase } from "../configs/database.config";
import { ITournamentAtters } from "../dtos/tournament.dto";
import { Tournament } from "../models/tournament.model";

export default class TournamentRepository {
  private _DB: IDatabase = DB;
  constructor() {
    this._DB = DB;
  }

  public async getTestData(): Promise<any> {}

  public async createBulkTournaments(
    tournamentData: ITournamentAtters[]
  ): Promise<any> {
    try {
      if (!tournamentData.length) {
        throw new BadRequestError("invalid tournament value");
      }

      const result = await this._DB.Tournament.bulkCreate(tournamentData, {
        updateOnDuplicate: Object.keys(
          Tournament.getAttributes()
        ) as (keyof ITournamentAtters)[],
        conflictAttributes: ["key"],
      });
      logger.info(`Inserted bulk data inside tournaments`);

      return result;
    } catch (error: any) {
      logger.error(`Database Error: ${error}`);
      throw new ServerError("Database Error");
    }
  }
}
