import { logger } from "@repo/common";
import { createClient, RedisClientType } from "redis";
import ServerConfigs from "./server.config";

export interface IRedis {
  connectClient(): Promise<void>;
  disconnectClient(): void;
  setter(key: string, value: string): Promise<boolean>;
  getter(key: string): Promise<any>;
  setInList(listKey: string, value: string): Promise<boolean>;
  getList(listKey: string, start?: number, end?: number): Promise<any[]>;
  popBatch(listKey: string, count: number): Promise<string[]>;
  deleter(key: string): Promise<boolean>;
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

  async setInList(listKey: string, value: string): Promise<boolean> {
    try {
      if (typeof listKey !== "string") listKey = JSON.stringify(listKey);
      if (typeof value !== "string") value = JSON.stringify(value);
      const result = await this.client.rPush(listKey, value);
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

   
  async getList(listKey: string, start: number = 0, end: number = -1): Promise<any[]> {
    try {
      if (typeof listKey !== "string") listKey = JSON.stringify(listKey);

      const result = await this.client.lRange(listKey, start, end);
      return result;
    } catch (err: any) {
      logger.error(`[redis-client]${err.message}`);
      return [];
    }
  }

  // (FIFO)
async popBatch(listKey: string, count: number): Promise<string[]> {
    try {
      const pipeline = this.client.multi();
      for (let i = 0; i < count; i++) pipeline.lPop(listKey);
      const results = await pipeline.exec() || [];
      return results
        .map(result => result === null ? null : String(result))
        .filter((item): item is string => item !== null);
    } catch (err: any) {
      logger.error(`[redis-pop] ${err.message}`);
      return [];
    }
  }

  async deleter(key: string): Promise<boolean> {
    try {
      if (typeof key !== "string") key = JSON.stringify(key);
      const result = await this.client.del(key);
      if (result > 0) {
        logger.info(`[redis-deleter] Deleted key: ${key}`);
        return true;
      } else {
        logger.warn(`[redis-deleter] Key not found: ${key}`);
        return false;
      }
    } catch (err: any) {
      logger.error(`[redis-deleter] ${err.message}`);
      return false;
    }
  }
}

export default new Redis();
