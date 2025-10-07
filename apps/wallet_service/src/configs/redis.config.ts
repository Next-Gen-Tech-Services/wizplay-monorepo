import { logger } from "@repo/common";
import { createClient, RedisClientType } from "redis";
import ServerConfigs from "./server.config";

export interface IRedis {
  connectClient(): Promise<void>;
  disconnectClient(): void;
  setter(key: string, value: string): Promise<boolean>;
  getter(key: string): Promise<any>;
}

class Redis implements IRedis {
  private client: RedisClientType;
  constructor() {
    this.client = createClient({
      username: ServerConfigs.REDIS_USERNAME,
      password: ServerConfigs.REDIS_PASSWORD,
      socket: {
        host: ServerConfigs.REDIS_HOST,
        port: +ServerConfigs.REDIS_PORT,
      },
    });
    this.client.on("ready", () => logger.info("Redis client is ready to use"));
    this.client.on("error", (err) => logger.error(err));
  }

  async connectClient() {
    try {
      await this.client.connect();
    } catch (err: any) {
      logger.error(err.message);
    }
  }

  async disconnectClient() {
    try {
      this.client.destroy();
    } catch (err: any) {
      logger.error(err.message);
    }
  }

  async setter(key: string, value: string): Promise<boolean> {
    try {
      if (typeof key !== "string") key = JSON.stringify(key);
      if (typeof value !== "string") value = JSON.stringify(value);
      const result = await this.client.set(key, value);
      if (result) {
        return true;
      } else {
        return false;
      }
    } catch (err: any) {
      logger.error(`[redis-client]${err.message}`);
      return false;
    }
  }

  async getter(key: string): Promise<any> {
    try {
      if (typeof key !== "string") key = JSON.stringify(key);
      const result = await this.client.get(key);
      return result;
    } catch (err: any) {
      logger.error(err.message);
    }
  }
}

export default new Redis();
