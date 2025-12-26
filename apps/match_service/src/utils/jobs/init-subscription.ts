import { logger } from "@repo/common";
import redis from "../../configs/redis.config";
import MatchRepository from "../../repositories/match.repository";
import MatchService from "../../services/match.service";
import MatchSubscriptionService from "./subscription";
import { generateApiToken } from "../utils";

let subscriptionServiceInstance: MatchSubscriptionService | null = null;

/**
 * Initialize and start the match subscription service
 * This service handles:
 * 1. Subscribing to matches 5 minutes before they start
 * 2. Polling match status every 2 minutes for subscribed matches
 * 3. Unsubscribing when matches complete
 */
export async function initializeSubscriptionService() {
  try {
    logger.info("[SUBSCRIPTION] Initializing match subscription service...");

    // Ensure Roanuz token is available in Redis
    let token = await generateApiToken();

    if (!token) {
      logger.warn(
        "[SUBSCRIPTION] No Roanuz token found in Redis. Will retry in 30 seconds..."
      );

      // Wait and retry once
      await new Promise((resolve) => setTimeout(resolve, 30000));
      token = await generateApiToken();

      if (!token) {
        throw new Error(
          "Roanuz token not available after retry. Please ensure token is generated."
        );
      }
    }

    logger.info("[SUBSCRIPTION] Roanuz token found, initializing service...");

    // Create instances
    const matchRepository = new MatchRepository();
    const matchService = new MatchService(matchRepository);

    // Create and start subscription service (token will be fetched dynamically)
    subscriptionServiceInstance = new MatchSubscriptionService(
      matchRepository,
      matchService
    );

    // Start monitoring with:
    // - Check for new matches to subscribe/unsubscribe every 10 minutes
    // - Poll status for subscribed matches every 2 minutes
    await subscriptionServiceInstance.startMonitoring(10);

    logger.info(
      "[SUBSCRIPTION] ✅ Match subscription service started successfully"
    );
    logger.info(
      "[SUBSCRIPTION] - Checking for new matches every 10 minutes"
    );
    logger.info(
      "[SUBSCRIPTION] - Polling subscribed matches status every 2 minutes"
    );

    return subscriptionServiceInstance;
  } catch (error: any) {
    logger.error(
      "[SUBSCRIPTION] ❌ Failed to initialize subscription service:",
      error.message
    );
    throw error;
  }
}

/**
 * Stop the subscription service (cleanup on shutdown)
 */
export function stopSubscriptionService() {
  if (subscriptionServiceInstance) {
    logger.info("[SUBSCRIPTION] Stopping subscription service...");
    subscriptionServiceInstance.stopMonitoring();
    subscriptionServiceInstance = null;
    logger.info("[SUBSCRIPTION] Subscription service stopped");
  }
}

/**
 * Get current subscription service instance
 */
export function getSubscriptionService() {
  return subscriptionServiceInstance;
}

/**
 * Get status report of subscription service
 */
export function getSubscriptionStatus() {
  if (!subscriptionServiceInstance) {
    return {
      status: "not_initialized",
      message: "Subscription service is not running",
    };
  }

  return {
    status: "running",
    ...subscriptionServiceInstance.getStatusReport(),
  };
}
