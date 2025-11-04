// src/services/contestStatus.service.ts
import { logger } from "@repo/common";
import { autoInjectable } from "tsyringe";
import ContestRepository from "../repositories/contest.repository";
import UserContestRepository from "../repositories/userContest.repository";

/**
 * Contest Status Management Service
 * Handles contest status transitions based on match status
 */
@autoInjectable()
export default class ContestStatusService {
  private contestRepo: ContestRepository;
  private userContestRepo: UserContestRepository;

  constructor() {
    this.contestRepo = new ContestRepository();
    this.userContestRepo = new UserContestRepository();
  }

  /**
   * Handle match status change and update related contests
   */
  public async handleMatchStatusChange(
    matchId: string,
    oldStatus: string,
    newStatus: string
  ) {
    try {
      logger.info(
        `Processing contest status changes for match ${matchId}: ${oldStatus} → ${newStatus}`
      );

      // Get all contests for this match
      const contests = await this.contestRepo.findByMatchId(matchId);

      if (!contests || contests.length === 0) {
        logger.debug(`No contests found for match ${matchId}`);
        return;
      }

      logger.info(`Found ${contests.length} contests for match ${matchId}`);

      // Process each contest based on new match status
      for (const contest of contests) {
        await this.updateContestStatus(contest, oldStatus, newStatus);
      }
    } catch (error: any) {
      logger.error(
        `Error handling match status change for match ${matchId}: ${error?.message}`
      );
      throw error;
    }
  }

  /**
   * Update individual contest status based on match status
   */
  private async updateContestStatus(
    contest: any,
    oldMatchStatus: string,
    newMatchStatus: string
  ) {
    try {
      let newContestStatus = contest.status;

      // Status transition logic
      switch (newMatchStatus) {
        case "scheduled":
        case "not_started":
          // Keep contest as scheduled
          if (contest.status === "scheduled") {
            return; // No change needed
          }
          break;

        case "started":
        case "live":
        case "in_progress":
          // Close contest when match starts (no more entries allowed)
          if (contest.status === "scheduled") {
            newContestStatus = "running";
            logger.info(
              `Closing contest ${contest.id} - Match has started`
            );
          }
          break;

        case "completed":
        case "finished":
          // Complete contest when match ends
          if (contest.status !== "completed") {
            newContestStatus = "completed";
            logger.info(
              `Completing contest ${contest.id} - Match has ended`
            );

            // Trigger result calculation
            await this.triggerResultCalculation(contest.id);
          }
          break;

        case "cancelled":
        case "abandoned":
          // Cancel contest if match is cancelled
          if (contest.status !== "cancelled") {
            newContestStatus = "cancelled";
            logger.info(
              `Cancelling contest ${contest.id} - Match was cancelled`
            );

            // Process refunds for cancelled contest
            await this.processRefunds(contest.id);
          }
          break;

        default:
          logger.debug(
            `No status change needed for contest ${contest.id} with match status ${newMatchStatus}`
          );
          return;
      }

      // Update contest status if changed
      if (newContestStatus !== contest.status) {
        await this.contestRepo.updateStatus(contest.id, newContestStatus);
        logger.info(
          `Updated contest ${contest.id} status: ${contest.status} → ${newContestStatus}`
        );
      }
    } catch (error: any) {
      logger.error(
        `Error updating contest ${contest.id} status: ${error?.message}`
      );
      throw error;
    }
  }

  /**
   * Trigger result calculation for completed contest
   */
  private async triggerResultCalculation(contestId: string) {
    try {
      logger.info(`Triggering result calculation for contest ${contestId}`);
      
      // TODO: Implement result calculation logic
      // This will be handled by the Answer Engine
      
      // For now, just log
      logger.info(`Result calculation queued for contest ${contestId}`);
    } catch (error: any) {
      logger.error(
        `Error triggering result calculation for contest ${contestId}: ${error?.message}`
      );
    }
  }

  /**
   * Process refunds for cancelled contest
   */
  private async processRefunds(contestId: string) {
    try {
      logger.info(`Processing refunds for cancelled contest ${contestId}`);

      // Get all users who joined this contest
      const userContests = await this.userContestRepo.findByContestId(contestId);

      if (!userContests || userContests.length === 0) {
        logger.debug(`No users to refund for contest ${contestId}`);
        return;
      }

      logger.info(
        `Processing refunds for ${userContests.length} users in contest ${contestId}`
      );

      // TODO: Implement refund logic via wallet service
      // For each user, refund the entry fee
      
      for (const userContest of userContests) {
        // await walletService.refund(userContest.userId, contest.entryFee);
        logger.debug(`Refund queued for user ${userContest.userId}`);
      }
    } catch (error: any) {
      logger.error(
        `Error processing refunds for contest ${contestId}: ${error?.message}`
      );
    }
  }

  /**
   * Check and close contests whose join deadline has passed
   */
  public async closeExpiredContests() {
    try {
      const now = Date.now();
      
      // Find all scheduled contests whose deadline has passed
      const expiredContests = await this.contestRepo.findExpiredScheduled(now);

      if (!expiredContests || expiredContests.length === 0) {
        return;
      }

      logger.info(`Found ${expiredContests.length} contests with expired deadlines`);

      for (const contest of expiredContests) {
        await this.contestRepo.updateStatus(contest.id, "running");
        logger.info(`Closed contest ${contest.id} - Join deadline passed`);
      }
    } catch (error: any) {
      logger.error(`Error closing expired contests: ${error?.message}`);
    }
  }
}
