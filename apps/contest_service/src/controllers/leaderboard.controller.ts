// src/controllers/leaderboard.controller.ts
import { logger, STATUS_CODE } from "@repo/common";
import { Request, Response } from "express";
import { autoInjectable } from "tsyringe";
import LeaderboardRepository from "../repositories/leaderboard.repository";
import ContestRepository from "../repositories/contest.repository";

@autoInjectable()
export default class LeaderboardController {
  constructor(
    private readonly leaderboardRepo: LeaderboardRepository,
    private readonly contestRepo: ContestRepository
  ) {}

  /**
   * GET /contests/:id/leaderboard
   * Get leaderboard for a specific contest
   */
  public async getContestLeaderboard(req: Request, res: Response) {
    try {
      const contestId = req.params.id;
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
      const userId = req.userId || (req.query.userId as string); // Current user if authenticated

      // Verify contest exists
      const contest = await this.contestRepo.findById(contestId);
      if (!contest) {
        return res.status(STATUS_CODE.NOT_FOUND).json({
          success: false,
          message: "Contest not found",
        });
      }

      // Get leaderboard
      const { entries, totalCount } =
        await this.leaderboardRepo.getContestLeaderboard(
          contestId,
          limit,
          offset
        );

      // Get user's rank if userId provided
      let userRank = null;
      if (userId) {
        userRank = await this.leaderboardRepo.getUserRankInContest(
          userId,
          contestId
        );
      }

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        data: {
          contestId,
          contestTitle: contest.title,
          totalParticipants: totalCount,
          leaderboard: entries,
          userRank,
          pagination: {
            limit,
            offset,
            total: totalCount,
            hasMore: offset + limit < totalCount,
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      logger.error(
        `LeaderboardController.getContestLeaderboard error: ${err?.message ?? err}`
      );
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        message: err.message || "Failed to fetch contest leaderboard",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * GET /leaderboard/user/:userId/contest/:contestId
   * Get specific user's rank and performance in a contest
   */
  public async getUserRankInContest(req: Request, res: Response) {
    try {
      const { userId, contestId } = req.params;

      // Check if user has access to this data
      if (req.userId && req.userId !== userId) {
        // Allow viewing other users' ranks (public data)
        logger.info(`User ${req.userId} viewing rank for user ${userId}`);
      }

      const userRank = await this.leaderboardRepo.getUserRankInContest(
        userId,
        contestId
      );

      if (!userRank) {
        return res.status(STATUS_CODE.NOT_FOUND).json({
          success: false,
          message: "User has not participated in this contest",
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        data: userRank,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      logger.error(
        `LeaderboardController.getUserRankInContest error: ${err?.message ?? err}`
      );
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        message: err.message || "Failed to fetch user rank",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * GET /leaderboard/match/:matchId
   * Get leaderboards for all contests in a match
   */
  public async getMatchLeaderboards(req: Request, res: Response) {
    try {
      const matchId = req.params.matchId;
      const topN = Math.min(parseInt(req.query.topN as string) || 10, 50);

      const matchLeaderboards =
        await this.leaderboardRepo.getMatchLeaderboards(matchId, topN);

      if (matchLeaderboards.length === 0) {
        return res.status(STATUS_CODE.NOT_FOUND).json({
          success: false,
          message: "No contests found for this match",
          timestamp: new Date().toISOString(),
        });
      }

      const totalParticipants = matchLeaderboards.reduce(
        (sum, contest) => sum + contest.topPerformers.length,
        0
      );

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        data: {
          matchId,
          totalContests: matchLeaderboards.length,
          totalParticipants,
          contests: matchLeaderboards,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      logger.error(
        `LeaderboardController.getMatchLeaderboards error: ${err?.message ?? err}`
      );
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        message: err.message || "Failed to fetch match leaderboards",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * GET /leaderboard/user/:userId/stats
   * Get user's global statistics across all contests
   */
  public async getUserGlobalStats(req: Request, res: Response) {
    try {
      const userId = req.params.userId;

      const stats = await this.leaderboardRepo.getUserGlobalStats(userId);

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      logger.error(
        `LeaderboardController.getUserGlobalStats error: ${err?.message ?? err}`
      );
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        message: err.message || "Failed to fetch user global stats",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * GET /leaderboard/user/:userId/history
   * Get user's detailed leaderboard history with performance stats
   */
  public async getUserLeaderboardHistory(req: Request, res: Response) {
    try {
      const userId = req.params.userId;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

      const history = await this.leaderboardRepo.getUserLeaderboardHistory(
        userId,
        limit
      );

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        data: history,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      logger.error(
        `LeaderboardController.getUserLeaderboardHistory error: ${err?.message ?? err}`
      );
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        message: err.message || "Failed to fetch user leaderboard history",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * GET /leaderboard/global
   * Get global leaderboard across all contests
   */
  public async getGlobalLeaderboard(req: Request, res: Response) {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
      const sortBy = (req.query.sortBy as "total" | "average") || "total";

      const leaderboard = await this.leaderboardRepo.getGlobalLeaderboard(
        limit,
        offset,
        sortBy
      );

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        data: {
          leaderboard,
          sortedBy: sortBy,
          pagination: {
            limit,
            offset,
            count: leaderboard.length,
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      logger.error(
        `LeaderboardController.getGlobalLeaderboard error: ${err?.message ?? err}`
      );
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        message: err.message || "Failed to fetch global leaderboard",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * GET /leaderboard/trending
   * Get leaderboard for a specific date range (weekly, monthly, etc.)
   */
  public async getTrendingLeaderboard(req: Request, res: Response) {
    try {
      const period = (req.query.period as string) || "week"; // week, month, year
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

      // Calculate date range based on period
      const endDate = new Date();
      const startDate = new Date();

      switch (period) {
        case "day":
          startDate.setDate(endDate.getDate() - 1);
          break;
        case "week":
          startDate.setDate(endDate.getDate() - 7);
          break;
        case "month":
          startDate.setMonth(endDate.getMonth() - 1);
          break;
        case "year":
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
        default:
          startDate.setDate(endDate.getDate() - 7);
      }

      const leaderboard =
        await this.leaderboardRepo.getLeaderboardByDateRange(
          startDate,
          endDate,
          limit
        );

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        data: {
          period,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          leaderboard,
          count: leaderboard.length,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      logger.error(
        `LeaderboardController.getTrendingLeaderboard error: ${err?.message ?? err}`
      );
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        message: err.message || "Failed to fetch trending leaderboard",
        timestamp: new Date().toISOString(),
      });
    }
  }
}
