import { logger, ServerError } from "@repo/common";
import ContestRepository from "../../repositories/wallet.repository";
import { KAFKA_EVENTS } from "../../types/events.type"; // adjust path if needed
import { kafkaClient } from "../kafka";

class ContestEventHandler {
  private contestRepository: ContestRepository;
  constructor() {
    this.contestRepository = new ContestRepository();
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

  //  TODO: save inside local cache
  private async handleContestFetchResponse(message: any): Promise<any> {
    const { match } = message.data;
  }
}

export default new ContestEventHandler();
