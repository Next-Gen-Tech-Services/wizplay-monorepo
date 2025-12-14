import { logger, ServerError } from "@repo/common";
import MatchRepository from "../../repositories/match.repository";
import { KAFKA_EVENTS } from "../../types/events.type";
import { kafkaClient, publishUserEvent } from "../kafka";

class MatchEventHandler {
  private matchRepository: MatchRepository;
  constructor() {
    this.matchRepository = new MatchRepository();
  }

  async handle(): Promise<void> {
    try {
      await kafkaClient.subscribeMultiple(async (message: any) => {
        logger.info("Received message:", message);
        switch (message.event) {
          case KAFKA_EVENTS.CONTEST_FETCH:
            logger.info(
              `Handle contest_fetch:, ${JSON.stringify(message.data)}`
            );
            await this.handleContestFetch(message);
            break;

          case KAFKA_EVENTS.USER_ADD_TO_WISHLIST:
            logger.info(
              `Handle user_add_to_wishlist:, ${JSON.stringify(message.data)}`
            );
            await this.handleUserAddToWishlist(message);
            break;

          case KAFKA_EVENTS.USER_REMOVE_FROM_WISHLIST:
            logger.info(
              `Handle user_remove_from_wishlist:, ${JSON.stringify(message.data)}`
            );
            await this.handleUserRemoveFromWishlist(message);
            break;

          default:
            logger.info("Unknown event:", message.event);
            break;
        }
      }, Object.values(KAFKA_EVENTS));
    } catch (error) {
      throw new ServerError("Error consuming event ");
    }
  }

  private async handleContestFetch(message: any): Promise<boolean> {
    const { matchId } = message.data;
    const result = await this.matchRepository.getMatchWithId(matchId);
    if (!result) {
      await publishUserEvent(KAFKA_EVENTS.CONTEST_FETCH_RESP, {
        match: false,
      });
      return false;
    } else {
      await publishUserEvent(KAFKA_EVENTS.CONTEST_FETCH_RESP, {
        match: result,
      });
      return true;
    }
  }
  private async handleUserAddToWishlist(message: any): Promise<boolean> {
    const { userId, matchId } = message.data;
    const result = await this.matchRepository.addToWishlist(userId, matchId);
    if (!result) {
      return false;
    } else {
      return true;
    }
  }

  private async handleUserRemoveFromWishlist(message: any): Promise<boolean> {
    const { userId, matchId } = message.data;
    logger.info(`Removing match ${matchId} from wishlist for user ${userId}`);
    
    try {
      const result = await this.matchRepository.removeFromWishlist(userId, matchId);
      if (!result) {
        logger.warn(`Failed to remove wishlist entry for user ${userId}, match ${matchId}`);
        return false;
      }
      logger.info(`Successfully removed match ${matchId} from wishlist for user ${userId}`);
      return true;
    } catch (error: any) {
      logger.error(`Error removing from wishlist: ${error?.message}`);
      return false;
    }
  }
}
export default new MatchEventHandler();
