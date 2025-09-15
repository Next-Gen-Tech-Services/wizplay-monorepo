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
}
export default new MatchEventHandler();
