import { logger } from "@repo/common";
import cron from "node-cron";
import axios from "axios";
import ServerConfigs from "../../configs/server.config";
import { DB } from "../../configs/database.config";
import { Op } from "sequelize";

/**
 * Auto Contest Generation Job
 * Automatically generates pre-match contests for visible matches 24 hours before they start
 * 
 * Rules:
 * 1. Only for matches with showOnFrontend = true
 * 2. Contest generated 24 hours before match expectedStartedAt or startedAt
 * 3. Sets contestGenerated = true on match to prevent duplicate generation
 * 4. Pre-match contests are created with status = "live" by default
 */
class AutoContestGenerationCron {
  private matchServiceUrl: string;

  constructor() {
    this.matchServiceUrl = ServerConfigs.MATCHES_SERVICE_URL || "http://localhost:8002";
  }

  /**
   * Get matches from match service that need contests
   */
  async getMatchesNeedingContests(): Promise<any[]> {
    try {
      const now = Math.floor(Date.now() / 1000); // Current time in unix seconds
      const twentyFourHoursFromNow = now + (24 * 60 * 60); // 24 hours from now
      const twentyFiveHoursFromNow = now + (25 * 60 * 60); // 25 hours from now (1 hour window)

      // Query match service for matches starting in 24-25 hours
      // Using internal endpoint to avoid auth issues
      const response = await axios.get(
        `${this.matchServiceUrl}/api/v1/matches/internal`,
        {
          params: {
            sport: "cricket",
            limit: 100,
            offset: 0,
          },
          timeout: 10000,
        }
      );

      const matches = response.data?.data?.items || [];

      // Filter matches that:
      // 1. Are visible on frontend (showOnFrontend = true)
      // 2. Start in 24-25 hours
      // 3. Don't have contests generated yet (contestGenerated = false)
      const eligibleMatches = matches.filter((match: any) => {
        const matchStartTime = match.expectedStartedAt || match.startedAt;
        
        return (
          match.showOnFrontend === true &&
          match.contestGenerated !== true &&
          matchStartTime >= twentyFourHoursFromNow &&
          matchStartTime <= twentyFiveHoursFromNow
        );
      });

      return eligibleMatches;
    } catch (error: any) {
      logger.error(`[AUTO-CONTEST-GEN] Error fetching matches: ${error.message}`);
      return [];
    }
  }

  /**
   * Mark match as having contests generated
   */
  async markMatchAsProcessed(matchId: string): Promise<void> {
    try {
      await axios.patch(
        `${this.matchServiceUrl}/api/v1/matches/${matchId}`,
        { contestGenerated: true },
        { timeout: 5000 }
      );
      logger.info(`[AUTO-CONTEST-GEN] Marked match ${matchId} as processed`);
    } catch (error: any) {
      logger.error(`[AUTO-CONTEST-GEN] Error marking match ${matchId}: ${error.message}`);
    }
  }

  /**
   * Generate pre-match contest for a match
   */
  async generateContestForMatch(match: any): Promise<void> {
    try {
      const matchStartTime = match.expectedStartedAt || match.startedAt;
      const contestStartTime = matchStartTime - (3 * 60 * 60); // 3 hours before match
      const contestEndTime = matchStartTime - (30 * 60); // 30 minutes before match

      // Create pre-match contest with status = "live" (ready for joining)
      const contest = await DB.Contest.create({
        matchId: match.id,
        title: `Pre-Match Predictions - ${match.shortName || match.name}`,
        description: `Predict the outcome before ${match.shortName || match.name} begins. Join now and test your cricket knowledge!`,
        type: "pre-match",
        difficulty: "beginner",
        startAt: contestStartTime,
        endAt: contestEndTime,
        entryFee: 0, // Free contest
        prizePool: 0,
        pointsPerQuestion: 10,
        questionsCount: 0, // Will be updated when questions are generated
        totalSpots: 10000,
        filledSpots: 0,
        displayEnabled: true,
        isPopular: false,
        joinDeadline: "before_match",
        resultTime: "end_of_match",
        timeCommitment: "5-10 minutes",
        platform: "mobile,web",
        status: "live", // Pre-match contests are live by default (open for joining)
      });

      logger.info(
        `[AUTO-CONTEST-GEN] Created contest ${contest.id} for match ${match.id} (${match.shortName})`
      );

      // Mark match as processed
      await this.markMatchAsProcessed(match.id);
    } catch (error: any) {
      logger.error(
        `[AUTO-CONTEST-GEN] Error creating contest for match ${match.id}: ${error.message}`
      );
    }
  }

  /**
   * Main job to generate contests
   */
  async generateContests(): Promise<void> {
    try {
      logger.info("[AUTO-CONTEST-GEN] Starting auto contest generation check");

      const matches = await this.getMatchesNeedingContests();

      if (matches.length === 0) {
        logger.info("[AUTO-CONTEST-GEN] No matches found needing contests");
        return;
      }

      logger.info(
        `[AUTO-CONTEST-GEN] Found ${matches.length} matches needing contests`
      );

      // Generate contests for each match
      for (const match of matches) {
        await this.generateContestForMatch(match);
      }

      logger.info(
        `[AUTO-CONTEST-GEN] Completed generating contests for ${matches.length} matches`
      );
    } catch (error: any) {
      logger.error(`[AUTO-CONTEST-GEN] Error in generateContests: ${error.message}`);
    }
  }

  /**
   * Schedule the cron job
   * Runs every hour to check for matches needing contests
   */
  scheduleJob(): void {
    // Run every hour at minute 0
    cron.schedule("0 * * * *", async () => {
      logger.info("[AUTO-CONTEST-GEN] Running auto contest generation check");
      await this.generateContests();
    });

    logger.info(
      "[AUTO-CONTEST-GEN] Auto contest generation cron job scheduled (every hour)"
    );
  }
}

export default new AutoContestGenerationCron();
