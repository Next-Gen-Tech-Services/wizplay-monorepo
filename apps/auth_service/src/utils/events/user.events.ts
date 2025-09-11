import { logger, ServerError } from "@repo/common";
import AuthRepository from "../../repositories/auth.repository";
import { KAFKA_EVENTS } from "../../types/events.type";
import { kafkaClient } from "../kafka";

class UserEventHandler {
  private authRepository: AuthRepository;
  constructor() {
    this.authRepository = new AuthRepository();
  }

  async handle(): Promise<void> {
    try {
      await kafkaClient.subscribeMultiple(async (message: any) => {
        logger.info("Received message:", message);
        switch (message.event) {
          case KAFKA_EVENTS.USER_ONBOARDED:
            logger.info(`Handle onboarding:, ${JSON.stringify(message.data)}`);
            await this.updateOnboardingStatus(message);
            break;
          case KAFKA_EVENTS.USER_LOGIN:
            logger.info("Handle login:", message.data);
            break;
          case KAFKA_EVENTS.USER_SEND_OTP:
            logger.info("Handle OTP:", message.data);
            break;
          case KAFKA_EVENTS.USER_SIGNUP:
            logger.info("Handle user signup:", message.data);
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

  private async updateOnboardingStatus(message: any): Promise<boolean> {
    const { userId, authId } = message.data;
    const result = await this.authRepository.updateOnboardingStatus(
      userId,
      authId
    );
    logger.info(
      `User onboarding successfully for userId: ${userId} | ${authId}`
    );
    return true;
  }
}
export default new UserEventHandler();
