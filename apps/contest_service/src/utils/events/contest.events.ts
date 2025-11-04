import { logger, ServerError } from "@repo/common";
import ContestRepository from "../../repositories/contest.repository";
import ContestStatusService from "../../services/contestStatus.service";
import { KAFKA_EVENTS } from "../../types/events.type"; // adjust path if needed
import { kafkaClient } from "../kafka";

class ContestEventHandler {
  private contestRepository: ContestRepository;
  private contestStatusService: ContestStatusService;

  constructor() {
    this.contestRepository = new ContestRepository();
    this.contestStatusService = new ContestStatusService();
  }

  public async handle(): Promise<void> {
    try {
      await kafkaClient.subscribeMultiple(async (message: any) => {
        // be defensive: guard shape
        const eventName: string | undefined = message?.event;

        switch (eventName) {
          case KAFKA_EVENTS.CONTEST_FETCH_RESP:
            logger.info("[contest-event] CONTEST_FETCH_RESP", message.data);
            break;

          case KAFKA_EVENTS.MATCH_STATUS_CHANGED:
            logger.info("[contest-event] MATCH_STATUS_CHANGED", message.data);
            await this.handleMatchStatusChanged(message);
            break;

          case KAFKA_EVENTS.MATCH_LIVE_DATA_UPDATE:
            logger.debug("[contest-event] MATCH_LIVE_DATA_UPDATE received");
            await this.handleMatchLiveDataUpdate(message);
            break;

          default:
            logger.debug("[contest-event] Unhandled event", {
              event: eventName,
            });
            break;
        }
      }, Object.values(KAFKA_EVENTS));
    } catch (err) {
      logger.error("[contest-event] subscribeMultiple failed", {
        error: (err as Error).message,
      });
      throw new ServerError("Error consuming contest events");
    }
  }

  /**
   * Handle match status change event
   */
  private async handleMatchStatusChanged(message: any): Promise<void> {
    try {
      const { matchId, oldStatus, newStatus } = message.data;
      
      if (!matchId || !newStatus) {
        logger.warn("Invalid MATCH_STATUS_CHANGED payload", message.data);
        return;
      }

      logger.info(
        `Processing match status change: ${matchId} (${oldStatus} → ${newStatus})`
      );

      await this.contestStatusService.handleMatchStatusChange(
        matchId,
        oldStatus,
        newStatus
      );
    } catch (error: any) {
      logger.error(
        `Error handling MATCH_STATUS_CHANGED: ${error?.message}`,
        { message }
      );
    }
  }

  /**
   * Handle match live data update event
   */
  private async handleMatchLiveDataUpdate(message: any): Promise<void> {
    try {
      const { matchId, liveData } = message.data;
      
      if (!matchId || !liveData) {
        logger.warn("Invalid MATCH_LIVE_DATA_UPDATE payload", message.data);
        return;
      }

      // TODO: Process live data for answer evaluation
      logger.debug(`Live data received for match ${matchId}`);
      
      // This will be used by the Answer Engine to evaluate user answers
      // and update leaderboards in real-time
    } catch (error: any) {
      logger.error(
        `Error handling MATCH_LIVE_DATA_UPDATE: ${error?.message}`,
        { message }
      );
    }
  }

  //  TODO: save inside local cache
  private async handleContestFetchResponse(message: any): Promise<any> {
    const { match } = message.data;
  }
}

export default new ContestEventHandler();
