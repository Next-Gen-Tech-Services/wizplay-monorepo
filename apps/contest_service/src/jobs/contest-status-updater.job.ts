import cron from 'node-cron';
import contestStatusService from '../services/contest-status.service';
import ContestRepository from '../repositories/contest.repository';
import axios from 'axios';
import ServerConfigs from '../configs/server.config';

const contestRepository = new ContestRepository();

/**
 * Background job to periodically update contest statuses
 * 
 * DEPRECATED: This job is no longer needed as contest statuses are now updated
 * directly in the live data webhook (match_service). When the webhook receives
 * Roanuz data, it triggers contest status updates and automatic answer generation
 * when contests move to "calculating" status.
 * 
 * Keeping this file for potential future use as a backup/recovery mechanism.
 */
class ContestStatusUpdaterJob {
  private task: cron.ScheduledTask | null = null;

  /**
   * Start the cron job (DISABLED)
   */
  start() {
    console.log('[CONTEST-STATUS-JOB] Job disabled - status updates now handled directly in live data webhook');
    // Job is disabled - all updates happen in the webhook
    return;
  }

  /**
   * Stop the cron job
   */
  stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log('[CONTEST-STATUS-JOB] Contest status updater job stopped');
    }
  }

  /**
   * Update statuses for all active contests
   */
  private async updateAllActiveContests() {
    try {
      console.log('[CONTEST-STATUS-JOB] Starting periodic status update...');

      // Get all contests that are not completed or cancelled
      const activeContests = await contestRepository.getActiveContests();
      
      if (activeContests.length === 0) {
        console.log('[CONTEST-STATUS-JOB] No active contests to update');
        return;
      }

      console.log(`[CONTEST-STATUS-JOB] Found ${activeContests.length} active contests to check`);

      // Group contests by matchId to minimize API calls
      const contestsByMatch = new Map<string, any[]>();
      
      for (const contest of activeContests) {
        if (!contest.matchId) continue;
        
        if (!contestsByMatch.has(contest.matchId)) {
          contestsByMatch.set(contest.matchId, []);
        }
        contestsByMatch.get(contest.matchId)!.push(contest);
      }

      console.log(`[CONTEST-STATUS-JOB] Processing ${contestsByMatch.size} unique matches`);

      // Process each match
      for (const [matchId, contests] of contestsByMatch) {
        await this.updateContestsForMatch(matchId, contests);
      }

      console.log('[CONTEST-STATUS-JOB] Periodic status update completed');
    } catch (error: any) {
      console.error('[CONTEST-STATUS-JOB] Error in periodic update:', error?.message || error);
    }
  }

  /**
   * Update contests for a specific match by fetching latest Roanuz data from Redis
   * The /live-data endpoint retrieves transformed Roanuz webhook data stored in Redis
   */
  private async updateContestsForMatch(matchId: string, contests: any[]) {
    try {
      console.log(`[CONTEST-STATUS-JOB] Fetching latest Roanuz data for match UUID: ${matchId}`);

      // Get latest Roanuz data from match_service (retrieves from Redis)
      const matchServiceUrl = ServerConfigs.MATCH_SERVICE_URL || 'http://localhost:4003';
      
      // This endpoint fetches the latest Roanuz webhook data stored in Redis
      const response = await axios.get(
        `${matchServiceUrl}/api/v1/matches/${matchId}/live-data`,
        { timeout: 5000 }
      );

      if (!response.data?.data) {
        console.log(`[CONTEST-STATUS-JOB] No Roanuz data available in Redis for match UUID: ${matchId}`);
        return;
      }

      const liveMatchData = response.data.data;
      
      console.log(`[CONTEST-STATUS-JOB] Processing ${contests.length} contests for match UUID: ${matchId}`);
      console.log(`[CONTEST-STATUS-JOB] Roanuz data - Match status=${liveMatchData.match?.status}, innings=${liveMatchData.live?.innings}, overs=${liveMatchData.live?.currentScore?.overs}`);

      // Update statuses using the contest status service with Roanuz data
      const results = await contestStatusService.updateContestStatuses(matchId, liveMatchData);
      
      if (results && results.length > 0) {
        console.log(`[CONTEST-STATUS-JOB] ✅ Updated ${results.length} contest statuses for match ${matchId}`);
        results.forEach(r => console.log(`[CONTEST-STATUS-JOB]   - Contest ${r.contestId}: ${r.oldStatus} → ${r.newStatus} (${r.reason})`));
      } else {
        console.log(`[CONTEST-STATUS-JOB] No status changes needed for match ${matchId}`);
      }

    } catch (error: any) {
      if (error?.response?.status === 404) {
        console.log(`[CONTEST-STATUS-JOB] Match not found or no live data: ${matchId}`);
      } else {
        console.error(`[CONTEST-STATUS-JOB] Error updating match ${matchId}:`, error?.message || error);
      }
    }
  }

  /**
   * Run update immediately (for testing or manual trigger)
   */
  async runNow() {
    console.log('[CONTEST-STATUS-JOB] Manual trigger - running update now...');
    await this.updateAllActiveContests();
  }
}

export const contestStatusUpdaterJob = new ContestStatusUpdaterJob();
