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

      // Only update fields that come from the API, preserve internal fields
      const fieldsToUpdate: (keyof ITournamentAtters)[] = [
        "name",
        "shortName",
        "alternateName",
        "alternateShortName",
        "updatedAt", // Always update timestamp
      ];

      const result = await this._DB.Tournament.bulkCreate(tournamentData, {
        updateOnDuplicate: fieldsToUpdate,
        conflictAttributes: ["key"],
      });
      logger.info(`Inserted/Updated ${result.length} tournaments in bulk`);

      return result;
    } catch (error: any) {
      logger.error(`Database Error: ${error}`);
      throw new ServerError("Database Error");
    }
  }

  public async fetchAllTournaments(): Promise<ITournamentAtters[]> {
    try {
      const tournaments = await Tournament.findAll({
        attributes: ["id", "key", "name", "shortName", "alternateName", "alternateShortName"],
        order: [["name", "ASC"]],
      });

      return tournaments.map((t: any) => t.get({ plain: true }));
    } catch (error: any) {
      logger.error(`Database Error: ${error}`);
      throw new ServerError("Database Error");
    }
  }
}
