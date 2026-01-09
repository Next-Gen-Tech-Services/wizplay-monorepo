import { logger } from "@repo/common";
import axios from "axios";
import ServerConfigs from "../../configs/server.config";
import { DB } from "../../configs/database.config";

// Notification types enum - keep in sync with @repo/notifications
enum NotificationType {
  CONTEST_LIVE = 'contest_live',
  CONTEST_COMPLETED = 'contest_completed',
}

/**
 * Contest Notification Service
 * Sends notifications when contest status changes
 */
class ContestNotificationService {
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
      logger.info(`[CONTEST-NOTIFICATIONS] Sent notification: ${payload.title} to ${payload.recipientType}`);
    } catch (error: any) {
      logger.error(`[CONTEST-NOTIFICATIONS] Failed to send notification: ${error.message}`);
    }
  }

  /**
   * Get users who joined a specific contest
   */
  private async getUsersJoinedForContest(contestId: string): Promise<string[]> {
    try {
      const userContests = await DB.UserContest.findAll({
        where: { contestId },
        attributes: ['userId']
      });
      return userContests.map(uc => uc.userId);
    } catch (error: any) {
      logger.error(`[CONTEST-NOTIFICATIONS] Failed to get joined users for contest ${contestId}: ${error.message}`);
      return [];
    }
  }

  /**
   * Get match info for contest notifications
   */
  private async getMatchInfo(matchId: string): Promise<{ teams: string; matchName: string } | null> {
    try {
      const response = await axios.get(
        `${ServerConfigs.MATCHES_SERVICE_URL}/api/v1/matches/${matchId}`,
        {
          timeout: 5000,
          headers: {
            'X-Internal-Request': 'true'
          }
        }
      );
      
      const match = response.data?.data;
      if (!match) return null;

      const teams = this.getTeamNames(match.teams);
      return {
        teams,
        matchName: match.shortName || match.name || teams
      };
    } catch (error: any) {
      logger.error(`[CONTEST-NOTIFICATIONS] Failed to get match info for ${matchId}: ${error.message}`);
      return null;
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
      
      if (teams.a && teams.b) {
        const teamA = teams.a?.name || teams.a?.code || 'Team A';
        const teamB = teams.b?.name || teams.b?.code || 'Team B';
        return `${teamA} vs ${teamB}`;
      }
      
      return "Match";
    } catch (error) {
      return "Match";
    }
  }

  /**
   * Send notification when contest goes live
   */
  public async notifyContestLive(contestId: string, contestTitle: string, matchId: string): Promise<void> {
    try {
      logger.info(`[CONTEST-NOTIFICATIONS] Sending live notification for contest: ${contestId}`);

      // Get contest details for richer notification data
      const contest = await DB.Contest.findByPk(contestId, {
        include: [
          {
            model: DB.Question,
            as: 'questions',
            attributes: ['id', 'type']
          }
        ]
      });

      if (!contest) {
        logger.error(`[CONTEST-NOTIFICATIONS] Contest ${contestId} not found`);
        return;
      }

      const matchInfo = await this.getMatchInfo(matchId);
      const teams = matchInfo?.teams || "Match";
      const contestName = contestTitle || "Contest";

      // Get users who have set reminders for this contest
      const usersWithReminders = await DB.ContestReminder.findAll({
        where: {
          contestId,
          isActive: true
        },
        attributes: ['userId']
      });

      const reminderUserIds = usersWithReminders.map(r => r.userId);

      if (reminderUserIds.length > 0) {
        logger.info(`[CONTEST-NOTIFICATIONS] Sending reminders to ${reminderUserIds.length} users with active reminders`);
        
        // Send personalized notifications to users who set reminders
        for (const userId of reminderUserIds) {
          await this.sendNotification({
            recipientType: 'user_id',
            userId: userId,
            title: '🎯 Your Contest is Now Live!',
            body: `The contest "${contestName}" you wanted to join for ${teams} is now live! Join now to predict and win rewards.`,
            type: NotificationType.CONTEST_LIVE,
            data: {
              contestId,
              contestTitle: contestName,
              matchId,
              teams,
              status: 'live',
              entryFee: contest.entryFee || 0,
              prizePool: contest.prizePool || 0,
              totalParticipants: contest.totalParticipants || 0,
              questionsCount: contest.questions?.length || 0,
              hasReminder: true,
              // Data needed to open the contest
              action: 'open_contest',
              contestData: {
                id: contestId,
                title: contestName,
                matchId: matchId,
              }
            },
          });
        }
        logger.info(`[CONTEST-NOTIFICATIONS] Sent live notifications to ${reminderUserIds.length} users with reminders`);
      } else {
        logger.info(`[CONTEST-NOTIFICATIONS] No users with active reminders for contest: ${contestName}`);
      }

      logger.info(`[CONTEST-NOTIFICATIONS] Completed live notification for contest: ${contestName} (${contestId})`);
    } catch (error: any) {
      logger.error(`[CONTEST-NOTIFICATIONS] Error sending live notification for contest ${contestId}: ${error.message}`);
    }
  }

  /**
   * Send notification when contest is completed
   */
  public async notifyContestCompleted(contestId: string, contestTitle: string, matchId: string): Promise<void> {
    try {
      logger.info(`[CONTEST-NOTIFICATIONS] Sending completion notification for contest: ${contestId}`);

      // Get contest details for richer notification
      const contest = await DB.Contest.findByPk(contestId, {
        include: [
          {
            model: DB.ContestPrize,
            as: 'prizes',
            attributes: ['id', 'position', 'amount', 'type']
          }
        ]
      });

      if (!contest) {
        logger.error(`[CONTEST-NOTIFICATIONS] Contest ${contestId} not found`);
        return;
      }

      const matchInfo = await this.getMatchInfo(matchId);
      const teams = matchInfo?.teams || "Match";
      const contestName = contestTitle || "Contest";

      // Get users who joined this contest
      const joinedUsers = await this.getUsersJoinedForContest(contestId);

      if (joinedUsers.length > 0) {
        logger.info(`[CONTEST-NOTIFICATIONS] Sending completion notifications to ${joinedUsers.length} joined users`);
        
        // Send personalized notification to users who joined
        for (const userId of joinedUsers) {
          // Get user's rank and winnings for this contest
          const userContest = await DB.UserContest.findOne({
            where: { userId, contestId },
            attributes: ['rank', 'score']
          });

          const rank = userContest?.rank;
          const score = userContest?.score || 0;
          
          await this.sendNotification({
            recipientType: 'user_id',
            userId: userId,
            title: '🏆 Contest Results Are Out!',
            body: `Results for "${contestName}" (${teams}) are now available. ${rank ? `You ranked #${rank}!` : 'Check your performance and rewards!'}`,
            type: NotificationType.CONTEST_COMPLETED,
            data: {
              contestId,
              contestTitle: contestName,
              matchId,
              teams,
              status: 'completed',
              hasJoined: true,
              userRank: rank || null,
              userScore: score,
              totalParticipants: contest.totalParticipants || 0,
              prizePool: contest.prizePool || 0,
              // Data needed to open the contest results
              action: 'open_contest_results',
              contestData: {
                id: contestId,
                title: contestName,
                matchId: matchId,
              }
            },
          });
        }
        logger.info(`[CONTEST-NOTIFICATIONS] Sent completion notifications to ${joinedUsers.length} joined users for: ${contestName}`);
      } else {
        logger.info(`[CONTEST-NOTIFICATIONS] No users joined contest: ${contestName}`);
      }

      logger.info(`[CONTEST-NOTIFICATIONS] Completed notification flow for contest: ${contestName} (${contestId})`);
    } catch (error: any) {
      logger.error(`[CONTEST-NOTIFICATIONS] Error sending completion notification for contest ${contestId}: ${error.message}`);
    }
  }
}

export default new ContestNotificationService();