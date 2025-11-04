// src/utils/kafka.consumer.ts
import { Kafka, Consumer, EachMessagePayload } from "kafkajs";
import { logger } from "@repo/common";
import ServerConfigs from "../configs/server.config";
import NotificationService from "../services/notification.service";
import { container } from "tsyringe";

const kafka = new Kafka({
  clientId: ServerConfigs.KAF_CLIENT_ID,
  brokers: ServerConfigs.KAF_BROKERS.split(","),
});

const consumer: Consumer = kafka.consumer({ groupId: ServerConfigs.KAF_GROUP_ID });

export async function connectConsumer() {
  try {
    await consumer.connect();
    logger.info("✅ Kafka consumer connected");

    await consumer.subscribe({
      topic: "notification.send",
      fromBeginning: false,
    });

    await consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        await handleNotificationEvent(payload);
      },
    });

    logger.info("✅ Subscribed to notification.send topic");
  } catch (error: any) {
    logger.error(`❌ Kafka consumer error: ${error?.message}`);
    throw error;
  }
}

// Alias for consistency
export const initializeKafkaConsumer = connectConsumer;

async function handleNotificationEvent(payload: EachMessagePayload) {
  const { topic, partition, message } = payload;

  try {
    const value = message.value?.toString();
    if (!value) return;

    const data = JSON.parse(value);
    logger.info(`Received notification event: ${data.type} for user ${data.userId}`);

    const notificationService = container.resolve(NotificationService);

    // Fetch device token if not provided
    if (!data.deviceToken) {
      data.deviceToken = await notificationService.getUserDeviceToken(data.userId);
    }

    // Send notification
    await notificationService.sendNotification(data);

    logger.info(`✅ Notification processed for user ${data.userId}`);
  } catch (err: any) {
    logger.error(`Failed to process notification event: ${err?.message ?? err}`);
  }
}

export async function disconnectConsumer() {
  try {
    await consumer.disconnect();
    logger.info("Kafka consumer disconnected");
  } catch (error: any) {
    logger.error(`Error disconnecting Kafka consumer: ${error?.message}`);
  }
}
