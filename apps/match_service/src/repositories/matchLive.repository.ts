import { logger } from "@repo/common";
import { Op } from "sequelize";
import { DB, IDatabase } from "../configs/database.config";
import { MatchLiveEventType } from "../models/matchLiveEvent.model";

export default class MatchLiveRepository {
  private _DB: IDatabase = DB;

  constructor() {
    this._DB = DB;
  }

  // Upsert current live state
  public async upsertLiveState(data: {
    matchId: string;
    currentScore: any;
    lastBallKey: string | null;
    inningsIndex: string | null;
    battingTeam: string | null;
    bowlingTeam: string | null;
  }): Promise<void> {
    try {
      await this._DB.MatchLiveState.upsert({
        matchId: data.matchId,
        currentScore: data.currentScore,
        lastBallKey: data.lastBallKey,
        inningsIndex: data.inningsIndex,
        battingTeam: data.battingTeam,
        bowlingTeam: data.bowlingTeam,
        lastUpdated: new Date(),
      });
    } catch (err: any) {
      logger.error(`Failed to upsert live state: ${err?.message ?? err}`);
      throw err;
    }
  }

  // Create live event
  public async createLiveEvent(data: {
    matchId: string;
    eventType: MatchLiveEventType;
    eventData: any;
    ballKey: string | null;
    timestamp: Date;
  }): Promise<void> {
    try {
      await this._DB.MatchLiveEvent.create({
        matchId: data.matchId,
        eventType: data.eventType,
        eventData: data.eventData,
        ballKey: data.ballKey,
        timestamp: data.timestamp,
        createdAt: new Date(),
      } as any);
    } catch (err: any) {
      logger.error(`Failed to create live event: ${err?.message ?? err}`);
      throw err;
    }
  }

  // Get current live state
  public async getCurrentLiveState(matchId: string) {
    try {
      return await this._DB.MatchLiveState.findByPk(matchId);
    } catch (err: any) {
      logger.error(`Failed to get live state: ${err?.message ?? err}`);
      return null;
    }
  }

  // Get all live events for a match
  public async getMatchEvents(
    matchId: string,
    eventType?: MatchLiveEventType,
    limit: number = 100
  ) {
    try {
      const where: any = { matchId };
      if (eventType) {
        where.eventType = eventType;
      }

      return await this._DB.MatchLiveEvent.findAll({
        where,
        order: [["timestamp", "DESC"]],
        limit,
      });
    } catch (err: any) {
      logger.error(`Failed to get match events: ${err?.message ?? err}`);
      return [];
    }
  }

  // Get match highlights (wickets + boundaries)
  public async getMatchHighlights(matchId: string) {
    try {
      return await this._DB.MatchLiveEvent.findAll({
        where: {
          matchId,
          eventType: {
            [Op.in]: ["wicket", "boundary"],
          },
        },
        order: [["timestamp", "ASC"]],
      });
    } catch (err: any) {
      logger.error(`Failed to get match highlights: ${err?.message ?? err}`);
      return [];
    }
  }

  // Cleanup old events (run as cron job)
  public async cleanupOldEvents(daysOld: number = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const deleted = await this._DB.MatchLiveEvent.destroy({
        where: {
          createdAt: {
            [Op.lt]: cutoffDate,
          },
        },
      });

      logger.info(`Cleaned up ${deleted} old live events`);
      return deleted;
    } catch (err: any) {
      logger.error(`Failed to cleanup old events: ${err?.message ?? err}`);
      return 0;
    }
  }
}
