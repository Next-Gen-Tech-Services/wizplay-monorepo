import { logger, ServerError } from "@repo/common";
import ContestRepository from "../../repositories/contest.repository";
import { ContestEvents } from "../../types/events.type"; // adjust path if needed
import { kafkaClient } from "../kafka";

class ContestEventHandler {
  private contestRepository: ContestRepository;
  constructor() {
    this.contestRepository = new ContestRepository();
  }

  public async handle(): Promise<void> {
    try {
      await kafkaClient.subscribeMultiple(async (message: any) => {
        try {
          logger.info("[contest-event] Received message:", {
            event: message?.event,
            data: message?.data,
            headers: message?.headers,
          });

          // be defensive: guard shape
          const eventName: string | undefined = message?.event;

          switch (eventName) {
            case ContestEvents.CONTEST_CREATED:
              logger.info("[contest-event] CONTEST_CREATED", message.data);

              if (this.contestRepository.createContest) {
                await this.contestRepository.createContest(message.data);
              } else {
                logger.warn(
                  "[contest-event] createFromEvent not implemented on repository"
                );
              }
              break;

            case ContestEvents.CONTEST_UPDATED:
              logger.info("[contest-event] CONTEST_UPDATED", message.data);

              break;

            case ContestEvents.CONTEST_CANCELLED:
              logger.info("[contest-event] CONTEST_CANCELLED", message.data);
              // TODO: mark contest cancelled

              break;

            case ContestEvents.CONTEST_COMPLETED:
              logger.info("[contest-event] CONTEST_COMPLETED", message.data);
              // TODO: mark contest completed

              break;
            default:
              logger.debug("[contest-event] Unhandled event", {
                event: eventName,
              });
              break;
          }
        } catch (innerErr) {
          // don't let a single message crash the consumer — log and continue
          logger.error("[contest-event] message handler error", {
            error: (innerErr as Error).message,
            message,
          });
        }
      }, Object.values(ContestEvents));
    } catch (err) {
      logger.error("[contest-event] subscribeMultiple failed", {
        error: (err as Error).message,
      });
      throw new ServerError("Error consuming contest events");
    }
  }
}

export default new ContestEventHandler();
