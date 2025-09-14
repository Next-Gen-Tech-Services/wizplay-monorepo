import { KafkaClient, logger } from "@repo/common";
import ServerConfigs from "../configs/server.config";
import { COUPON_EVENTS } from "../types";

export const kafkaClient = new KafkaClient(
  {
    clientId: ServerConfigs.KAF_CLIENT_ID,
    brokers: ServerConfigs.KAF_BROKERS.split(","),
    groupId: ServerConfigs.KAF_GROUP_ID,
    topics: Object.values(COUPON_EVENTS),
  },
  logger
);

export const connectProducer = async () => {
  const producer = await kafkaClient.connectProducer();
  return producer;
};

// Publish an event
export const publishUserEvent = async (
  event: COUPON_EVENTS,
  data: Record<string, any>
) => {
  await kafkaClient.publish({
    topic: event,
    event,
    message: data,
    headers: { source: "coupon-service" },
  });
};
