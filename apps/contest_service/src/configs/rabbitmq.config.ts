import { logger } from "@repo/common";
import amqplib from "amqplib";
import ServerConfigs from "./server.config";

export interface IRabbitmq {
  connectClient(): Promise<any>;
  getChannel(): Promise<any>;
}

class Rabbitmq implements IRabbitmq {
  public channel: any;
  private static instance: Rabbitmq;

  constructor() { }

  static getInstance(): Rabbitmq {
    if (!Rabbitmq.instance) {
      Rabbitmq.instance = new Rabbitmq();
    }
    return Rabbitmq.instance;
  }

  async connectClient() {
    try {
      const conn: any = await amqplib.connect(ServerConfigs.RABBITMQ_URL);
      this.channel = await conn.createChannel();
      logger.info("Rabbit client is connected");
    } catch (err: any) {
      logger.error(err.message);
    }
  }

  async getChannel() {
    return this.channel;
  }
}

// Initialize connection
const rabbitmqInstance = Rabbitmq.getInstance();

export default rabbitmqInstance;
