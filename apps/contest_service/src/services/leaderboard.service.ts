// src/services/leaderboard.service.ts
// Optional caching layer for leaderboard performance optimization
// NOTE: This service requires Redis methods with TTL support and delete functionality
// Currently commented out due to Redis client limitations. 
// Uncomment and implement when Redis client is updated with:
// - setter(key, value, ttl)
// - deleter(key)
// - scan(pattern)

import { logger } from "@repo/common";
import LeaderboardRepository from "../repositories/leaderboard.repository";
// import redis from "../configs/redis.config";

export default class LeaderboardService {
  constructor(private readonly leaderboardRepo: LeaderboardRepository) {}

  /**
   * Get contest leaderboard with caching
   * Cache for 5 minutes to reduce database load
   * 
   * TODO: Enable when Redis client supports TTL
   */
  async getContestLeaderboardCached(
    contestId: string,
    limit: number = 100,
    offset: number = 0
  ) {
    // For now, directly return from repository
    // Add caching when Redis client is updated
    try {
      const result = await this.leaderboardRepo.getContestLeaderboard(
        contestId,
        limit,
        offset
      );

      return {
        ...result,
        fromCache: false,
      };
    } catch (err: any) {
      logger.error(
        `LeaderboardService.getContestLeaderboardCached error: ${err?.message ?? err}`
      );
      throw err;
    }

  
  }

 
  async invalidateContestLeaderboardCache(contestId: string) {
    logger.debug(`Cache invalidation requested for contest ${contestId}`);
   
  }

  /**
   * Pre-warm cache for popular contests
   * Call this periodically or after contest completion
   */
  async prewarmLeaderboardCache(contestId: string) {
    try {
      logger.info(`Pre-warming leaderboard cache for contest ${contestId}`);
      
      // Cache first 3 pages (top 150 users typically)
      await this.getContestLeaderboardCached(contestId, 50, 0);
      await this.getContestLeaderboardCached(contestId, 50, 50);
      await this.getContestLeaderboardCached(contestId, 50, 100);
      
      logger.info(`Successfully pre-warmed cache for contest ${contestId}`);
    } catch (err: any) {
      logger.error(
        `LeaderboardService.prewarmLeaderboardCache error: ${err?.message ?? err}`
      );
    }
  }

  /**
   * Get global leaderboard with caching
   * 
   * TODO: Enable when Redis client supports TTL
   */
  async getGlobalLeaderboardCached(
    limit: number = 50,
    offset: number = 0,
    sortBy: "total" | "average" = "total"
  ) {
    try {
      const leaderboard = await this.leaderboardRepo.getGlobalLeaderboard(
        limit,
        offset,
        sortBy
      );

      return {
        leaderboard,
        fromCache: false,
      };
    } catch (err: any) {
      logger.error(
        `LeaderboardService.getGlobalLeaderboardCached error: ${err?.message ?? err}`
      );
      throw err;
    }
  }

  /**
   * Invalidate user-specific caches when they submit
   * 
   * TODO: Enable when Redis client supports delete
   */
  async invalidateUserCaches(userId: string) {
    logger.debug(`Cache invalidation requested for user ${userId}`);
    // Implement when Redis client is updated with delete support
  }
}
