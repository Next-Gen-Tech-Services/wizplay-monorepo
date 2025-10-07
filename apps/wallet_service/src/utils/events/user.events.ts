import WalletRepository from "@/repositories/wallet.repository";
import { logger, ServerError } from "@repo/common";
import { KAFKA_EVENTS } from "../../types/events.type";
import { kafkaClient } from "../kafka";

class UserEventHandler {
  private walletRepository: WalletRepository;
  constructor() {
    this.walletRepository = new WalletRepository();
  }

  async handle(): Promise<void> {
    try {
      await kafkaClient.subscribeMultiple(async (message: any) => {
        logger.info("Received message:", message);
        switch (message.event) {
          case KAFKA_EVENTS.USER_SIGNUP:
            logger.info(`Handle signup:, ${JSON.stringify(message.data)}`);
            break;
          case KAFKA_EVENTS.USER_LOGIN:
            logger.info("Handle login:", message.data);
            break;
          case KAFKA_EVENTS.USER_SEND_OTP:
            logger.info("Handle OTP:", message.data);
            break;
          case KAFKA_EVENTS.USER_ONBOARDED:
            await this.handleWalletCreation(message);
            logger.info("Handle login:", message.data);
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

  private async handleWalletCreation(message: any): Promise<boolean> {
    const { userId, authId } = message.data;
    const result = await this.walletRepository.createWallet(userId, authId);
    logger.info(
      `User wallet created successfully for userId: ${userId} | ${authId}`
    );
    return true;
  }
}
export default new UserEventHandler();
