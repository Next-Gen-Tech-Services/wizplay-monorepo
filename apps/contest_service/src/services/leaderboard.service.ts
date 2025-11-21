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

    /* CACHING CODE - Enable when Redis client supports TTL
    const cacheKey = `leaderboard:contest:${contestId}:${limit}:${offset}`;

    try {
      // Try cache first
      const cached = await redis.getter(cacheKey);
      if (cached) {
        logger.debug(`Leaderboard cache HIT for ${contestId}`);
        return {
          ...JSON.parse(cached),
          fromCache: true,
        };
      }

      // Cache miss - fetch from database
      logger.debug(`Leaderboard cache MISS for ${contestId}`);
      const result = await this.leaderboardRepo.getContestLeaderboard(
        contestId,
        limit,
        offset
      );

      // Cache for 5 minutes (requires Redis client update)
      await redis.setter(cacheKey, JSON.stringify(result), 300);

      return {
        ...result,
        fromCache: false,
      };
    } catch (err: any) {
      logger.error(
        `LeaderboardService.getContestLeaderboardCached error: ${err?.message ?? err}`
      );
      return this.leaderboardRepo.getContestLeaderboard(
        contestId,
        limit,
        offset
      );
    }
    */
  }

  /**
   * Invalidate leaderboard cache when new submission arrives
   * 
   * TODO: Enable when Redis client supports delete
   */
  async invalidateContestLeaderboardCache(contestId: string) {
    // Placeholder - implement when Redis client is updated
    logger.debug(`Cache invalidation requested for contest ${contestId}`);
    
    /* CACHING CODE - Enable when Redis supports delete
    try {
      // Delete all cached pages for this contest
      const pattern = `leaderboard:contest:${contestId}:*`;
      
      // For production, use Redis SCAN with pattern matching
      const keys = await this.getKeysByPattern(pattern);
      
      if (keys.length > 0) {
        await Promise.all(keys.map((key) => redis.deleter(key)));
        logger.info(
          `Invalidated ${keys.length} leaderboard cache entries for contest ${contestId}`
        );
      }
    } catch (err: any) {
      logger.error(
        `LeaderboardService.invalidateContestLeaderboardCache error: ${err?.message ?? err}`
      );
    }
    */
  }

  /**
   * Get keys matching pattern (helper for cache invalidation)
   */
  private async getKeysByPattern(pattern: string): Promise<string[]> {
    // This is a simplified version
    // In production, implement proper SCAN-based pattern matching
    // to avoid blocking Redis with KEYS command
    return [];
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
