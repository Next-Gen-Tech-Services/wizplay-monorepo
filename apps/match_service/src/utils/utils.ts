import { logger } from "@repo/common";
import ServerConfigs from "../configs/server.config";
import axios from "axios";
import crypto from "crypto";
import redis from "../configs/redis.config";
import matchCron from "../utils/jobs/match";
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
    const tokenExpiry = await redis.getter("roanuzTokenExpiry");
    
    // Check if token exists and is not expired
    if (redisToken && tokenExpiry) {
      const expiryTime = parseFloat(tokenExpiry);
      const currentTime = Date.now() / 1000; // Convert to seconds
      
      // Add 60 second buffer to avoid using token at the edge of expiry
      if (currentTime < (expiryTime - 60)) {
        logger.info(`[UTILS] Using existing valid Roanuz token (expires in ${Math.floor((expiryTime - currentTime) / 60)} minutes)`);
        return redisToken;
      } else {
        logger.warn(`[UTILS] Token expired or expiring soon, generating new one...`);
      }
    } else if (tokenExpiry && !redisToken) {
      logger.warn("[UTILS] Token expiry exists but token missing, clearing expiry...");
      await redis.deleter("roanuzTokenExpiry");
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
      const expiresAt = response?.data?.data?.expires;
      
      // Calculate TTL based on expires timestamp
      const currentTime = Date.now() / 1000;
      const ttl = Math.floor(expiresAt - currentTime - 300); // Expire 5 minutes before actual expiry
      
      // Store token and expiry timestamp
      const tokenResult = await redis.setter("roanuzToken", authToken, ttl);
      const expiryResult = await redis.setter("roanuzTokenExpiry", expiresAt.toString(), ttl);
      
      if(!tokenResult || !expiryResult) {
        logger.error("[UTILS] Failed to store Roanuz token in Redis");
      }
      logger.info(`[UTILS] Roanuz API token generated and cached until ${new Date(expiresAt * 1000).toISOString()}`);
      return authToken;
    } catch (error: any) {
      logger.error(`[MATCH-CRON] Error in auth api ${error.message}`);
    }
}

export async function forceRefreshApiToken(): Promise<string | undefined> {
  try {
    logger.info("[UTILS] Force refreshing Roanuz token...");
    
    // Clear existing token and expiry
    await redis.deleter("roanuzToken");
    await redis.deleter("roanuzTokenExpiry");
    
    // Generate new token
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
    const expiresAt = response?.data?.data?.expires;
    
    // Calculate TTL based on expires timestamp
    const currentTime = Date.now() / 1000;
    const ttl = Math.floor(expiresAt - currentTime - 300); // Expire 5 minutes before actual expiry
    
    // Store token and expiry timestamp
    const tokenResult = await redis.setter("roanuzToken", authToken, ttl);
    const expiryResult = await redis.setter("roanuzTokenExpiry", expiresAt.toString(), ttl);
    
    if(!tokenResult || !expiryResult) {
      logger.error("[UTILS] Failed to store Roanuz token in Redis");
    }
    
    logger.info(`[UTILS] ✅ Roanuz API token force-refreshed and cached until ${new Date(expiresAt * 1000).toISOString()}`);
    return authToken;
  } catch (error: any) {
    logger.error(`[UTILS] ❌ Error in force refresh token: ${error.message}`);
    throw error;
  }
}

export async function generateRefershApiToken(refresh: boolean = false): Promise<string | undefined> {
  try {
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
      const expiresAt = response?.data?.data?.expires;
      
      // Calculate TTL based on expires timestamp
      const currentTime = Date.now() / 1000;
      const ttl = Math.floor(expiresAt - currentTime - 300); // Expire 5 minutes before actual expiry
      
      // Store token and expiry timestamp
      const tokenResult = await redis.setter("roanuzToken", authToken, ttl);
      const expiryResult = await redis.setter("roanuzTokenExpiry", expiresAt.toString(), ttl);
      
      if(!tokenResult || !expiryResult) {
        logger.error("[UTILS] Failed to store Roanuz token in Redis");
      }
      logger.info(`[UTILS] Roanuz API token refreshed and cached until ${new Date(expiresAt * 1000).toISOString()}`);
      return authToken;
    } catch (error: any) {
      logger.error(`[MATCH-CRON] Error in auth api ${error.message}`);
    }
}
