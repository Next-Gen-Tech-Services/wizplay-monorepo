// packages/common/src/kafka/producer.ts
import { Kafka, Producer, ProducerRecord } from "kafkajs";
import { logger } from "../utils/globalLogger";

let kafkaProducer: Producer | null = null;

interface KafkaConfig {
  clientId: string;
  brokers: string[];
}

export async function initializeKafkaProducer(config: KafkaConfig): Promise<void> {
  try {
    const kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
    });

    kafkaProducer = kafka.producer();
    await kafkaProducer.connect();
    logger.info("✅ Kafka producer connected");
  } catch (error: any) {
    logger.error(`❌ Failed to initialize Kafka producer: ${error?.message}`);
    throw error;
  }
}

export async function publishToKafka(topic: string, message: any): Promise<void> {
  if (!kafkaProducer) {
    logger.warn("Kafka producer not initialized. Skipping message publication.");
    return;
  }

  try {
    const record: ProducerRecord = {
      topic,
      messages: [
        {
          value: JSON.stringify(message),
          timestamp: Date.now().toString(),
        },
      ],
    };

    await kafkaProducer.send(record);
    logger.info(`✅ Message published to Kafka topic: ${topic}`);
  } catch (error: any) {
    logger.error(`❌ Failed to publish message to Kafka: ${error?.message}`);
    // Don't throw error - notification failures shouldn't break the main flow
  }
}

export async function disconnectKafkaProducer(): Promise<void> {
  if (kafkaProducer) {
    try {
      await kafkaProducer.disconnect();
      logger.info("Kafka producer disconnected");
    } catch (error: any) {
      logger.error(`Error disconnecting Kafka producer: ${error?.message}`);
    }
  }
}

export function getKafkaProducer(): Producer | null {
  return kafkaProducer;
}
