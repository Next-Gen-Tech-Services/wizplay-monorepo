import { validateRequest } from "@repo/common";
import { Request, Response, Router } from "express";
import "reflect-metadata";
import { container } from "tsyringe";
import MatchController from "../controllers/match.controller";
import FlagController from "../controllers/flag.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { listMatchesValidator } from "../validators";
import { getSubscriptionStatus } from "../utils/jobs/init-subscription";
import { generateApiToken } from "../utils/utils";
import TournamentRepository from "../repositories/tournament.repository";
import { STATUS_CODE } from "@repo/common";

const router = Router();

// GET /tournaments - List all tournaments
router.get("/matches/tournaments", async (req: Request, res: Response) => {
  try {
    const tournamentRepo = new TournamentRepository();
    const tournaments = await tournamentRepo.fetchAllTournaments();
    return res.status(STATUS_CODE.SUCCESS).json({
      success: true,
      message: "tournaments fetched successfully",
      data: tournaments,
      errors: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch tournaments",
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /matches/stats - Stats for analytics dashboard
router.get("/matches/stats", async (req: Request, res: Response) => {
  const controller = container.resolve(MatchController);
  return controller.getMatchStats(req, res);
});

// GET /matches/internal - Internal endpoint for service-to-service calls (no auth)
router.get(
  "/matches/internal",
  listMatchesValidator(),
  validateRequest,
  async (req: Request, res: Response) => {
    const controller = container.resolve(MatchController);
    return controller.getAllMatches(req, res);
  }
);

// GET /matches/internal/:id - Internal endpoint for getting specific match (no auth)
router.get(
  "/matches/internal/:id",
  async (req: Request, res: Response) => {
    const controller = container.resolve(MatchController);
    return controller.getMatchById(req, res);
  }
);

// GET /matches
router.get(
  "/matches",
  requireAuth,
  listMatchesValidator(),
  validateRequest,
  async (req: Request, res: Response) => {
    const controller = container.resolve(MatchController);
    return controller.getAllMatches(req, res);
  }
);

router.get(
  "/matches/:id",
  listMatchesValidator(),
  validateRequest,
  async (req: Request, res: Response) => {
    const controller = container.resolve(MatchController);
    return controller.getMatchById(req, res);
  }
);

// GET /matches/:id/team-data - Get team data from Roanuz API
router.get("/matches/:id/team-data", async (req: Request, res: Response) => {
  const controller = container.resolve(MatchController);
  return controller.getMatchTeamData(req, res);
});

// PATCH /matches/:id - Update showOnFrontend flag
router.patch(
  "/matches/:id",
  validateRequest,
  async (req: Request, res: Response) => {
    const controller = container.resolve(MatchController);
    return controller.updateMatch(req, res);
  }
);

// PATCH /matches/:key/status - Update match status, winner, timestamps
router.patch(
  "/matches/:key/status",
  validateRequest,
  async (req: Request, res: Response) => {
    const controller = container.resolve(MatchController);
    return controller.updateMatchStatus(req, res);
  }
);

// POST /livematch webhook
router.post("/matches/livematch", async (req: Request, res: Response) => {
  const controller = container.resolve(MatchController);
  return controller.liveMatchData(req, res);
});

// subscribe/unsubscribe
router.post("/matches/subscribe/:id", async (req: Request, res: Response) => {
  const controller = container.resolve(MatchController);
  return controller.subscribeMatch(req, res);
});
router.post("/matches/unsubscribe/:id", async (req: Request, res: Response) => {
  const controller = container.resolve(MatchController);
  return controller.unsubscribeMatch(req, res);
});

// Flag management routes (admin/debug)
router.post("/flags/sync", async (req: Request, res: Response) => {
  const controller = new FlagController();
  return controller.syncFlags(req, res);
});

router.get("/flags/status", async (req: Request, res: Response) => {
  const controller = new FlagController();
  return controller.getFlagStatus(req, res);
});

// Live match data routes
router.get("/matches/:id/live-score", async (req: Request, res: Response) => {
  const controller = container.resolve(MatchController);
  return controller.getLiveScore(req, res);
});

router.get("/matches/:id/events", async (req: Request, res: Response) => {
  const controller = container.resolve(MatchController);
  return controller.getMatchEvents(req, res);
});

router.get("/matches/:id/highlights", async (req: Request, res: Response) => {
  const controller = container.resolve(MatchController);
  return controller.getMatchHighlights(req, res);
});

// Subscription status endpoint (for debugging/monitoring)
router.get(
  "/matches/subscription/status",
  async (req: Request, res: Response) => {
    try {
      const status = getSubscriptionStatus();
      return res.status(200).json({
        success: true,
        data: status,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Subscription status endpoint (for debugging/monitoring)
router.get("/matches/regenerate-token", async (req: Request, res: Response) => {
  try {
    const newToken = await generateApiToken();
    return res.status(200).json({
      success: true,
      data: { token: newToken },
      message :"API token regenerated successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
