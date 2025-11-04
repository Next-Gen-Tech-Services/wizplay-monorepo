// src/utils/jobs/matchStatusUpdater.ts
import { logger } from "@repo/common";
import cron, { ScheduledTask } from "node-cron";
import MatchRepository from "../../repositories/match.repository";
import { publishUserEvent } from "../kafka";
import { KAFKA_EVENTS } from "../../types/events.type";

/**
 * Match Status Updater Job
 * Polls Roanuz API to get updated match statuses and publishes events
 */
class MatchStatusUpdater {
  private matchRepository: MatchRepository;
  private isRunning: boolean = false;
  private cronJob: ScheduledTask | null = null;

  constructor() {
    this.matchRepository = new MatchRepository();
  }

  /**
   * Start the cron job to check match status every minute
   */
  public start() {
    // Run every minute
    this.cronJob = cron.schedule("*/1 * * * *", async () => {
      await this.checkAndUpdateMatches();
    });

    logger.info("✅ Match Status Updater job started - Running every minute");
  }

  /**
   * Stop the cron job
   */
  public stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      logger.info("❌ Match Status Updater job stopped");
    }
  }

  /**
   * Main function to check and update match statuses
   */
  private async checkAndUpdateMatches() {
    if (this.isRunning) {
      logger.debug("Status update already running, skipping...");
      return;
    }

    this.isRunning = true;

    try {
      logger.debug("Checking for match status updates...");

      // Get all active matches (not completed/cancelled)
      const activeMatches = await this.matchRepository.getActiveMatches();
      
      if (!activeMatches || activeMatches.length === 0) {
        logger.debug("No active matches to update");
        this.isRunning = false;
        return;
      }

      logger.info(`Found ${activeMatches.length} active matches to check`);

      // Process each match
      for (const match of activeMatches) {
        try {
          await this.processMatchStatus(match);
        } catch (error: any) {
          logger.error(`Error processing match ${match.key}: ${error?.message}`);
        }
      }

      logger.debug("Match status check completed");
    } catch (error: any) {
      logger.error(`Error in match status updater: ${error?.message}`);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process individual match status
   */
  private async processMatchStatus(match: any) {
    try {
      // Fetch updated match data from Roanuz API
      const updatedMatchData = await this.matchRepository.fetchMatchFromRoanuz(
        match.key
      );

      if (!updatedMatchData) {
        logger.warn(`Could not fetch data for match ${match.key}`);
        return;
      }

      const oldStatus = match.status;
      const newStatus = updatedMatchData.status;

      // Check if status changed
      if (oldStatus !== newStatus) {
        logger.info(
          `Match ${match.key} status changed: ${oldStatus} → ${newStatus}`
        );

        // Update match in database
        await this.matchRepository.updateMatchStatus(match.id, {
          status: newStatus,
          winner: updatedMatchData.winner,
          startedAt: updatedMatchData.startedAt,
          endedAt: updatedMatchData.endedAt,
        });

        // Publish status change event to Kafka
        await this.publishStatusChangeEvent(match.id, match.key, oldStatus, newStatus);
      }

      // Update live match data if match is in progress
      if (newStatus === "started" || newStatus === "live") {
        await this.updateLiveMatchData(match.id, updatedMatchData);
      }
    } catch (error: any) {
      logger.error(`Error processing match ${match.key}: ${error?.message}`);
      throw error;
    }
  }

  /**
   * Publish match status change event to Kafka
   */
  private async publishStatusChangeEvent(
    matchId: string,
    matchKey: string,
    oldStatus: string,
    newStatus: string
  ) {
    try {
      await publishUserEvent(KAFKA_EVENTS.MATCH_STATUS_CHANGED, {
        matchId,
        matchKey,
        oldStatus,
        newStatus,
        timestamp: new Date().toISOString(),
      });

      logger.info(
        `Published MATCH_STATUS_CHANGED event for match ${matchKey}: ${oldStatus} → ${newStatus}`
      );
    } catch (error: any) {
      logger.error(
        `Failed to publish status change event for match ${matchKey}: ${error?.message}`
      );
    }
  }

  /**
   * Update live match data for in-progress matches
   */
  private async updateLiveMatchData(matchId: string, matchData: any) {
    try {
      // Store live data in a separate table or update match record
      await this.matchRepository.updateLiveData(matchId, matchData);
      
      // Publish live data update event
      await publishUserEvent(KAFKA_EVENTS.MATCH_LIVE_DATA_UPDATE, {
        matchId,
        liveData: matchData,
        timestamp: new Date().toISOString(),
      });

      logger.debug(`Updated live data for match ${matchId}`);
    } catch (error: any) {
      logger.error(`Failed to update live data for match ${matchId}: ${error?.message}`);
    }
  }
}

export default new MatchStatusUpdater();
