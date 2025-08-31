import { KafkaClient, logger } from "@repo/common";
import ServerConfigs from "../configs/server.config";
import { UserEvents } from "./events/user.events";


const kafkaClient = new KafkaClient({
  clientId: ServerConfigs.KAF_CLIENT_ID,
  brokers: ServerConfigs.KAF_BROKERS.split(","),
  groupId: ServerConfigs.KAF_GROUP_ID,
  topics: Object.values(UserEvents)
}, logger);

export const connectProducer = async () => {
  const producer = await kafkaClient.connectProducer();
  return producer;
}

// Publish an event
export const publishUserEvent = async (event: UserEvents, data: Record<string, any>) => {
  await kafkaClient.publish({
    topic: event,
    event,
    message: data,
    headers: { source: "user-service" }
  });
};

// Subscribe to multiple events at once
export const subscribeToUserEvents = async () => {
  await kafkaClient.subscribeMultiple(async (message) => {
    logger.info("Received message:", message);
    switch (message.event) {
      case UserEvents.USER_SIGNUP:
        logger.info(`Handle signup:, ${JSON.stringify(message.data)}`);
        break;
      case UserEvents.USER_LOGIN:
        logger.info("Handle login:", message.data);
        break;
      case UserEvents.USER_SEND_OTP:
        logger.info("Handle OTP:", message.data);
        break;
      default:
        logger.info("Unknown event:", message.event);
    }
  }, Object.values(UserEvents));
};