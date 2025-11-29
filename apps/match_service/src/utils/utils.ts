import { logger } from "@repo/common";
import ServerConfigs from "../configs/server.config";
import axios from "axios";
import crypto from "crypto";
import redis from "../configs/redis.config";

export function generateOTPUtil(): string {
  const buffer = crypto.randomInt(1000, 9999);
  return buffer.toString();
}

export function generateUUID(): string {
  return crypto.randomUUID();
}

export async function generateApiToken(): Promise<string | undefined> {
  try {
    const redisToken = await redis.getter("roanuzToken");
    if (redisToken) {
      return redisToken;
    }
    const response = await axios({
      method: "POST",
      url: `https://api.sports.roanuz.com/v5/core/${ServerConfigs.ROANUZ_PK}/auth/`,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: new URLSearchParams({ api_key: ServerConfigs.ROANUZ_AK }).toString(),
    });

      if (response?.status !== 200) {
        throw new Error(response?.data?.error);
      }
      const authToken = response?.data?.data?.token;
      const result = await redis.setter("roanuzToken", authToken, 36000);
      if(!result) {
        logger.error("[UTILS] Failed to store Roanuz token in Redis");
      }
      return authToken;
    } catch (error: any) {
      logger.error(`[MATCH-CRON] Error in auth api ${error.message}`);
    }
  }
