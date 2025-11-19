import { logger } from "@repo/common";
import cron from "node-cron";
import axios from "axios";
import ServerConfigs from "../../configs/server.config";
import { DB } from "../../configs/database.config";
import { Op } from "sequelize";

/**
 * Contest Auto-Completion Job
 * Automatically completes contests based on their type and live match data from Roanuz webhook:
 * 
 * - pre-match: Completes 30 minutes before match starts
 * - powerplay: Completes when match starts (play_status = "in_play")
 * - middle_overs: Completes when powerplay ends (after 6 overs in live data)
 * - death_overs: Completes when death overs start (16+ overs for T20, 40+ for ODI)
 * - first_innings/innings_1: Completes when first innings starts (from live innings data)
 * - second_innings/innings_2: Completes when second innings starts (from live innings data)
 * - full_match: Completes when match ends
 * - session_*: Completes at session start (from live session data)
 * - day*: Completes at day start (from live day_number data)
 */
class ContestCompletionCron {
  private matchServiceUrl: string;

  constructor() {
    this.matchServiceUrl = ServerConfigs.MATCHES_SERVICE_URL || "http://localhost:8002";
  }

  /**
   * Get match details from match service
   */
  async getMatchDetails(matchId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.matchServiceUrl}/api/v1/matches/${matchId}`,
        { timeout: 5000 }
      );
      return response.data?.data;
    } catch (error: any) {
      logger.error(`[CONTEST-COMPLETION] Error fetching match ${matchId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Complete contests based on their type and match timing
   */
  async completeContests() {
    try {
      const now = Math.floor(Date.now() / 1000); // Current time in unix seconds

      // Find all active contests that need to be checked
      const contests = await DB.Contest.findAll({
        where: {
          status: "upcoming",
          startAt: {
            [Op.lte]: now + 1800, // Check contests starting within next 30 minutes
          },
        },
        attributes: ["id", "matchId", "type", "timeCommitment", "startAt", "endAt"],
      });

      logger.info(`[CONTEST-COMPLETION] Found ${contests.length} contests to check`);

      for (const contest of contests) {
        const contestData = contest.get({ plain: true });
        await this.processContest(contestData, now);
      }
    } catch (error: any) {
      logger.error(`[CONTEST-COMPLETION] Error in completeContests: ${error.message}`);
    }
  }

  /**
   * Process individual contest for completion
   */
  async processContest(contest: any, currentTime: number) {
    try {
      // Get match details
      const match = await this.getMatchDetails(contest.matchId);
      if (!match) {
        logger.warn(`[CONTEST-COMPLETION] Match ${contest.matchId} not found for contest ${contest.id}`);
        return;
      }

      const matchStartTime = match.startedAt || match.expectedStartedAt;
      const matchStatus = match.status;
      const playStatus = match.play_status;

      let shouldComplete = false;
      let reason = "";

      // Determine if contest should be completed based on type
      const contestType = contest.type?.toLowerCase() || contest.timeCommitment?.toLowerCase() || "";

      // Pre-match contests: Complete 30 minutes before match starts
      if (contestType.includes("pre-match") || contestType.includes("prematch")) {
        const completionTime = matchStartTime - 1800; // 30 minutes before
        if (currentTime >= completionTime) {
          shouldComplete = true;
          reason = "Pre-match contest completed 30 minutes before match start";
        }
      }

      // Powerplay contests: Complete when match starts
      else if (contestType.includes("powerplay")) {
        if (matchStatus === "started" || playStatus === "in_play") {
          shouldComplete = true;
          reason = "Powerplay contest completed at match start";
        }
      }

      // Middle overs contests: Complete when powerplay ends (after 6 overs in first innings)
      else if (contestType.includes("middle_overs") || contestType.includes("middle")) {
        if (matchStatus === "started" && match.play?.live) {
          const liveInnings = match.play.live.innings;
          const currentOvers = match.play.live.score?.overs?.[0] || 0;
          
          // Middle overs start after powerplay (6 overs)
          if (currentOvers >= 6) {
            shouldComplete = true;
            reason = `Middle overs contest completed at ${currentOvers} overs`;
          }
        }
      }

      // Death overs contests: Complete when death overs start (after 40 overs in ODI or 16 overs in T20)
      else if (contestType.includes("death_overs") || contestType.includes("death")) {
        if (matchStatus === "started" && match.play?.live) {
          const currentOvers = match.play.live.score?.overs?.[0] || 0;
          const matchFormat = match.format; // "oneday", "t20", "test"
          
          // Death overs: 40+ for ODI, 16+ for T20
          const deathOversStart = matchFormat === "t20" ? 16 : 40;
          
          if (currentOvers >= deathOversStart) {
            shouldComplete = true;
            reason = `Death overs contest completed at ${currentOvers} overs`;
          }
        }
      }

      // First innings contests: Complete when first innings starts
      else if (contestType.includes("first_innings") || contestType.includes("innings_1") || contestType.includes("1st_innings")) {
        if (matchStatus === "started" && match.play?.live?.innings) {
          const currentInnings = match.play.live.innings;
          // First innings has started
          if (currentInnings) {
            shouldComplete = true;
            reason = `First innings contest completed at innings start`;
          }
        }
      }

      // Second innings contests: Complete when second innings starts
      else if (contestType.includes("second_innings") || contestType.includes("innings_2") || contestType.includes("2nd_innings")) {
        if (matchStatus === "started" && match.play?.innings) {
          const innings = match.play.innings;
          const inningsKeys = Object.keys(innings);
          
          // Check if second innings has started (e.g., "a_1" and "b_1" both exist, or "a_2", "b_2")
          const secondInningsStarted = inningsKeys.some(key => key.endsWith("_2") || inningsKeys.length > 1);
          
          if (secondInningsStarted) {
            shouldComplete = true;
            reason = `Second innings contest completed at second innings start`;
          }
        }
      }

      // Session-based contests: Complete at session start time
      else if (contestType.includes("session")) {
        // For test matches, check actual session from live data
        if (match.play?.live?.session && matchStatus === "started") {
          shouldComplete = true;
          reason = `Session contest completed at session start`;
        } else if (currentTime >= contest.startAt) {
          shouldComplete = true;
          reason = `Session contest completed at scheduled time`;
        }
      }

      // Day-based contests: Complete at day start
      else if (contestType.includes("day1") || contestType.includes("day2") || contestType.match(/day\d/)) {
        if (match.play?.day_number && matchStatus === "started") {
          shouldComplete = true;
          reason = `Day contest completed at day ${match.play.day_number} start`;
        } else if (currentTime >= contest.startAt) {
          shouldComplete = true;
          reason = `Day contest completed at scheduled time`;
        }
      }

      // Full match contests: Complete when match ends
      else if (contestType.includes("full_match") || contestType.includes("fullmatch")) {
        if (match.endedAt && currentTime >= match.endedAt) {
          shouldComplete = true;
          reason = "Full match contest completed at match end";
        } else if (matchStatus === "completed") {
          shouldComplete = true;
          reason = "Full match contest completed (match completed)";
        }
      }

      // Default: Complete at contest start time
      else {
        if (currentTime >= contest.startAt) {
          shouldComplete = true;
          reason = "Contest completed at scheduled start time";
        }
      }

      // Update contest status if should be completed
      if (shouldComplete) {
        await DB.Contest.update(
          { status: "completed" },
          { where: { id: contest.id } }
        );
        logger.info(`[CONTEST-COMPLETION] Contest ${contest.id} completed. Reason: ${reason}`);
      }
    } catch (error: any) {
      logger.error(`[CONTEST-COMPLETION] Error processing contest ${contest.id}: ${error.message}`);
    }
  }

  /**
   * Schedule the cron job
   * Runs every 5 minutes to check for contests that need to be completed
   */
  scheduleJob() {
    // Run every 5 minutes
    cron.schedule("*/5 * * * *", async () => {
      logger.info("[CONTEST-COMPLETION] Running contest completion check");
      await this.completeContests();
    });

    logger.info("[CONTEST-COMPLETION] Contest completion cron job scheduled (every 5 minutes)");
  }
}

export default new ContestCompletionCron();
