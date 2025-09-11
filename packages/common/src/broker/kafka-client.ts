import {
  Admin,
  Consumer,
  Kafka,
  logLevel,
  Partitioners,
  Producer,
} from "kafkajs";
import { logger as defaultLogger } from "../utils/globalLogger";
import {
  MessageBrokerType,
  MessageHandler,
  PublishType,
  TOPIC_TYPE,
} from "./kafka-client.types";

export interface KafkaClientOptions {
  clientId: string;
  brokers: string[];
  groupId: string;
  topics?: string[];
  numPartitions?: number;
  replicationFactor?: number;
}

export class KafkaClient implements MessageBrokerType {
  private kafka: Kafka;
  private producer?: Producer;
  private consumer?: Consumer;
  private options: KafkaClientOptions;
  private logger: any;

  constructor(options: KafkaClientOptions, logger: any) {
    this.options = options;
    this.logger = logger || defaultLogger;
    this.kafka = new Kafka({
      clientId: options.clientId,
      brokers: options.brokers,
      logLevel: logLevel.INFO,
    });
  }

  async createTopics(topics: string[]) {
    const admin: Admin = this.kafka.admin();
    await admin.connect();

    const existingTopics = await admin.listTopics();
    const topicsToCreate = topics
      .filter((t) => !existingTopics.includes(t))
      .map((t) => ({
        topic: t,
        numPartitions: 1,
        replicationFactor: 1,
      }));

    if (topicsToCreate.length > 0) {
      await admin.createTopics({ topics: topicsToCreate });
      this.logger.info(
        `Created Topics: ${topicsToCreate.map((t) => t.topic).join(", ")}`
      );
    }

    await admin.disconnect();
  }

  async connectProducer(): Promise<Producer> {
    if (!this.producer) {
      if (this.options.topics) {
        await this.createTopics(this.options.topics);
      }
      this.producer = this.kafka.producer({
        createPartitioner: Partitioners.DefaultPartitioner,
      });
      await this.producer.connect();

      this.producer.on("producer.connect", () => {
        console.log(`[Kafka] Producer connected (${this.options.clientId})`);
      });

      this.producer.on("producer.disconnect", () => {
        console.log(`[Kafka] Producer disconnected (${this.options.clientId})`);
      });
    } else {
      this.logger.warn("Producer already connected!");
    }
    return this.producer;
  }

  async disconnectProducer() {
    if (this.producer) {
      await this.producer.disconnect();
      this.logger.info("Producer disconnected!");
    }
  }

  async connectConsumer(): Promise<Consumer> {
    if (!this.consumer) {
      this.consumer = this.kafka.consumer({ groupId: this.options.groupId });
      await this.consumer.connect();

      this.consumer.on("consumer.connect", () => {
        console.log(`[Kafka] Producer connected (${this.options.clientId})`);
      });

      this.consumer.on("consumer.disconnect", () => {
        console.log(`[Kafka] Producer disconnected (${this.options.clientId})`);
      });
    } else {
      this.logger.warn("Consumer already connected!");
    }
    return this.consumer;
  }

  async disconnectConsumer() {
    if (this.consumer) {
      await this.consumer.disconnect();
      this.logger.info("Consumer disconnected!");
    }
  }

  async publish(data: PublishType): Promise<boolean> {
    const producer = await this.connectProducer();
    const result = await producer.send({
      topic: data.topic,
      messages: [
        {
          key: data.event,
          value: JSON.stringify(data.message),
          headers: data.headers,
        },
      ],
    });
    this.logger.info(
      `Event Published: ${data.event} | ${data.topic} | ${JSON.stringify(result)}`
    );
    return result.length > 0;
  }

  async subscribe(handler: MessageHandler, topic: TOPIC_TYPE): Promise<void> {
    const consumer = await this.connectConsumer();
    await consumer.subscribe({ topic, fromBeginning: true });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.key || !message.value) return;

        await handler({
          event: message.key.toString() as any,
          data: JSON.parse(message.value.toString()),
          headers: message.headers,
        });

        await consumer.commitOffsets([
          { topic, partition, offset: (Number(message.offset) + 1).toString() },
        ]);
      },
    });
  }

  // kafka-client.ts inside your reusable package
  async subscribeMultiple(
    messageHandler: MessageHandler,
    topics: string[]
  ): Promise<void> {
    const consumer = await this.connectConsumer();

    for (const topic of topics) {
      await consumer.subscribe({ topic, fromBeginning: true });
    }

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.key || !message.value) return;

        try {
          await messageHandler({
            event: message.key.toString(),
            data: JSON.parse(message.value.toString()),
            headers: message.headers,
          });

          // Only commit if processing was successful
          await consumer.commitOffsets([
            {
              topic,
              partition,
              offset: (Number(message.offset) + 1).toString(),
            },
          ]);

          this.logger.info(
            `Successfully processed message: ${message.key} from ${topic}`
          );
        } catch (error) {
          this.logger.error(
            `Failed to process message: ${message.key} from ${topic}`,
            error
          );

          // Options for error handling:
          // 1. Don't commit (message will be redelivered)
          // 2. Send to dead letter queue
          // 3. Retry with exponential backoff
          throw error;
        }
      },
    });
  }
}
