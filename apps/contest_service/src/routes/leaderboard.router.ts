// src/routes/leaderboard.router.ts
import { Router } from "express";
import "reflect-metadata";
import { container } from "tsyringe";
import LeaderboardController from "../controllers/leaderboard.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();
const leaderboardController: LeaderboardController = container.resolve(
  LeaderboardController
);

/**
 * Contest Leaderboards
 */

// Get leaderboard for a specific contest
router.get("/contests/:id/leaderboard", async (req, res) => {
  return await leaderboardController.getContestLeaderboard(req, res);
});

/**
 * User-specific Rankings
 */

// Get user's rank in a specific contest
router.get(
  "/leaderboard/user/:userId/contest/:contestId",
  async (req, res) => {
    return await leaderboardController.getUserRankInContest(req, res);
  }
);

// Get user's global statistics
router.get("/leaderboard/user/:userId/stats", async (req, res) => {
  return await leaderboardController.getUserGlobalStats(req, res);
});

// Get user's detailed leaderboard history and performance stats
router.get("/leaderboard/user/:userId/history", async (req, res) => {
  return await leaderboardController.getUserLeaderboardHistory(req, res);
});

/**
 * Match Leaderboards
 */

// Get leaderboards for all contests in a match
router.get("/leaderboard/match/:matchId", async (req, res) => {
  return await leaderboardController.getMatchLeaderboards(req, res);
});

/**
 * Global Leaderboards
 */

// Get global leaderboard across all contests
router.get("/leaderboard/global", async (req, res) => {
  return await leaderboardController.getGlobalLeaderboard(req, res);
});

// Get trending leaderboard (weekly, monthly, etc.)
router.get("/leaderboard/trending", async (req, res) => {
  return await leaderboardController.getTrendingLeaderboard(req, res);
});

export default router;
