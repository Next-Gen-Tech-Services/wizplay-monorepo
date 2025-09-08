import { logger, ServerError } from "@repo/common";
import UserRepository from "../../repositories/user.repository";
import { KAFKA_EVENTS } from "../../types/events.type";
import { kafkaClient } from "../kafka";

class UserEventHandler {
  private userRepository: UserRepository;
  constructor() {
    this.userRepository = new UserRepository();
  }

  async handle(): Promise<void> {
    try {
      await kafkaClient.subscribeMultiple(async (message: any) => {
        logger.info("Received message:", message);
        switch (message.event) {
          case KAFKA_EVENTS.USER_SIGNUP:
            logger.info(`Handle signup:, ${JSON.stringify(message.data)}`);
            await this.handleUserSignup(message);
            break;
          case KAFKA_EVENTS.USER_LOGIN:
            logger.info("Handle login:", message.data);
            break;
          case KAFKA_EVENTS.USER_SEND_OTP:
            logger.info("Handle OTP:", message.data);
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

  private async handleUserSignup(message: any): Promise<boolean> {
    const { userId, email, authId } = message.data;

    logger.info(
      `User signup processed successfully for userId: ${userId} | ${authId}`
    );
    return true;
  }
}
export default new UserEventHandler();
