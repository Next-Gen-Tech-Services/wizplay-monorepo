import { logger } from "@repo/common";
import cron from "node-cron";
import axios from "axios";
import ServerConfigs from "../../configs/server.config";
import { DB } from "../../configs/database.config";
import { Op } from "sequelize";

// Notification types enum - keep in sync with @repo/notifications
enum NotificationType {
  MATCH_STARTING_SOON = 'match_starting_soon',
  MATCH_STARTED = 'match_started',
  CONTEST_LIVE = 'contest_live',
  CONTEST_COMPLETED = 'contest_completed',
}

/**
 * Match Notification Job
 * Sends automatic notifications for match events:
 * 1. 30 minutes before match starts
 * 2. When match actually starts
 */
class MatchNotificationCron {
  private notificationServiceUrl: string;

  constructor() {
    this.notificationServiceUrl = ServerConfigs.NOTIFICATION_SERVICE_URL || "http://localhost:8001";
  }

  /**
   * Send notification via notification service
   */
  private async sendNotification(payload: {
    recipientType: 'user_id' | 'email' | 'phone' | 'all_users';
    userId?: string;
    recipientValue?: string;
    title: string;
    body: string;
    type: NotificationType;
    data?: Record<string, any>;
    imageUrl?: string;
  }): Promise<void> {
    try {
      await axios.post(
        `${this.notificationServiceUrl}/api/v1/notifications/send`,
        payload,
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Request': 'true'
          }
        }
      );
      logger.info(`[MATCH-NOTIFICATIONS] Sent notification: ${payload.title} to ${payload.recipientType}`);
    } catch (error: any) {
      logger.error(`[MATCH-NOTIFICATIONS] Failed to send notification: ${error.message}`);
    }
  }

  /**
   * Get all users who have joined contests for a match
   */
  private async getUsersJoinedForMatch(matchId: string): Promise<string[]> {
    try {
      const response = await axios.get(
        `${ServerConfigs.CONTEST_SERVICE_URL}/api/v1/contests/internal/match/${matchId}/users`,
        {
          timeout: 5000,
          headers: {
            'X-Internal-Request': 'true'
          }
        }
      );
      return response.data?.data?.userIds || [];
    } catch (error: any) {
      logger.error(`[MATCH-NOTIFICATIONS] Failed to get joined users for match ${matchId}: ${error.message}`);
      return [];
    }
  }

  /**
   * Check for matches starting in 30 minutes and send notifications
   */
  async checkMatchesStartingSoon(): Promise<void> {
    try {
      const now = Math.floor(Date.now() / 1000);
      const thirtyMinutesFromNow = now + (30 * 60); // 30 minutes from now
      const thirtyFiveMinutesFromNow = now + (35 * 60); // 35 minutes from now (5-minute window)

      // Find matches starting in 30-35 minutes that haven't sent "starting soon" notification
      const matches = await DB.Match.findAll({
        where: {
          status: 'not_started',
          showOnFrontend: true,
          expectedStartedAt: {
            [Op.gte]: thirtyMinutesFromNow,
            [Op.lte]: thirtyFiveMinutesFromNow,
          },
          startingSoonNotificationSent: {
            [Op.ne]: true,
          }
        },
        limit: 50,
      });

      if (matches.length === 0) {
        return;
      }

      logger.info(`[MATCH-NOTIFICATIONS] Found ${matches.length} matches starting soon`);

      for (const match of matches) {
        try {
          const matchData = match.toJSON();
          const teamNames = this.getTeamNames(matchData.teams);
          
          // Send notification to all users
          await this.sendNotification({
            recipientType: 'all_users',
            title: '🏏 Match Starting Soon!',
            body: `${teamNames} starts in 30 minutes. Don't miss out on the action!`,
            type: NotificationType.MATCH_STARTING_SOON,
            data: {
              matchId: matchData.id,
              matchKey: matchData.key,
              teams: teamNames,
              startTime: matchData.expectedStartedAt || matchData.startedAt,
            },
          });

          // Mark as notified
          await DB.Match.update(
            { startingSoonNotificationSent: true },
            { where: { id: matchData.id } }
          );

          logger.info(`[MATCH-NOTIFICATIONS] Sent "starting soon" notification for match: ${teamNames}`)
        } catch (error: any) {
          logger.error(`[MATCH-NOTIFICATIONS] Failed to process match ${match.id}: ${error.message}`)
        }
      }
    } catch (error: any) {
      logger.error(`[MATCH-NOTIFICATIONS] Error in checkMatchesStartingSoon: ${error.message}`);
    }
  }

  /**
   * Check for matches that have started and send notifications
   */
  async checkMatchesStarted(): Promise<void> {
    try {
      const now = Math.floor(Date.now() / 1000);
      
      // Find matches that just started (status changed to 'started' in last 10 minutes)
      // and haven't sent "match started" notification yet
      const matches = await DB.Match.findAll({
        where: {
          status: 'started',
          showOnFrontend: true,
          startedAt: {
            [Op.gte]: now - (10 * 60), // Started within last 10 minutes
          },
          matchStartedNotificationSent: {
            [Op.ne]: true,
          }
        },
        limit: 50,
      });

      if (matches.length === 0) {
        return;
      }

      logger.info(`[MATCH-NOTIFICATIONS] Found ${matches.length} matches that started`);

      for (const match of matches) {
        try {
          const matchData = match.toJSON();
          const teamNames = this.getTeamNames(matchData.teams);
          
          // Get users who joined contests for this match
          const joinedUsers = await this.getUsersJoinedForMatch(matchData.id);
          
          if (joinedUsers.length > 0) {
            // Send personalized notification to users who joined contests
            for (const userId of joinedUsers) {
              await this.sendNotification({
                recipientType: 'user_id',
                userId: userId,
                title: '🚀 Your Match Has Started!',
                body: `${teamNames} is now LIVE! Follow your contest progress.`,
                type: NotificationType.MATCH_STARTED,
                data: {
                  matchId: matchData.id,
                  matchKey: matchData.key,
                  teams: teamNames,
                  hasJoinedContest: true,
                },
              });
            }
            logger.info(`[MATCH-NOTIFICATIONS] Sent personalized "match started" notifications to ${joinedUsers.length} users for: ${teamNames}`);
          }

          // Send general notification to all users
          await this.sendNotification({
            recipientType: 'all_users',
            title: '🏏 Live Match Started!',
            body: `${teamNames} is now LIVE! Join contests and predict the action.`,
            type: NotificationType.MATCH_STARTED,
            data: {
              matchId: matchData.id,
              matchKey: matchData.key,
              teams: teamNames,
              hasJoinedContest: false,
            },
          });

          // Mark as notified
          await DB.Match.update(
            { matchStartedNotificationSent: true },
            { where: { id: matchData.id } }
          );

          logger.info(`[MATCH-NOTIFICATIONS] Sent "match started" notification for match: ${teamNames}`)
        } catch (error: any) {
          logger.error(`[MATCH-NOTIFICATIONS] Failed to process started match ${match.id}: ${error.message}`)
        }
      }
    } catch (error: any) {
      logger.error(`[MATCH-NOTIFICATIONS] Error in checkMatchesStarted: ${error.message}`);
    }
  }

  /**
   * Extract team names from match teams data
   */
  private getTeamNames(teams: any): string {
    try {
      if (!teams) return "Match";
      
      if (typeof teams === 'string') {
        return teams;
      }
      
      if (Array.isArray(teams) && teams.length >= 2) {
        return `${teams[0]?.name || teams[0]?.short_name || 'Team A'} vs ${teams[1]?.name || teams[1]?.short_name || 'Team B'}`;
      }
      
      if (teams.team_a && teams.team_b) {
        const teamA = teams.team_a?.name || teams.team_a?.short_name || 'Team A';
        const teamB = teams.team_b?.name || teams.team_b?.short_name || 'Team B';
        return `${teamA} vs ${teamB}`;
      }
      
      return "Match";
    } catch (error) {
      return "Match";
    }
  }

  /**
   * Main job to check for match notifications
   */
  async checkMatchNotifications(): Promise<void> {
    try {
      logger.info("[MATCH-NOTIFICATIONS] Checking for match notifications");

      // Check matches starting soon (every 5 minutes)
      await this.checkMatchesStartingSoon();
      
      // Check matches that started (every 2 minutes)  
      await this.checkMatchesStarted();

      logger.info("[MATCH-NOTIFICATIONS] Completed match notification check");
    } catch (error: any) {
      logger.error(`[MATCH-NOTIFICATIONS] Error in checkMatchNotifications: ${error.message}`);
    }
  }

  /**
   * Schedule the cron jobs
   */
  scheduleJobs(): void {
    // Run every 2 minutes for match started notifications
    cron.schedule("*/2 * * * *", async () => {
      logger.info("[MATCH-NOTIFICATIONS] Running match started notification check");
      await this.checkMatchesStarted();
    });

    // Run every 5 minutes for starting soon notifications  
    cron.schedule("*/5 * * * *", async () => {
      logger.info("[MATCH-NOTIFICATIONS] Running starting soon notification check");
      await this.checkMatchesStartingSoon();
    });

    logger.info("[MATCH-NOTIFICATIONS] Match notification cron jobs scheduled");
    logger.info("[MATCH-NOTIFICATIONS] - Starting soon: every 5 minutes");
    logger.info("[MATCH-NOTIFICATIONS] - Match started: every 2 minutes");
  }
}

export default new MatchNotificationCron();