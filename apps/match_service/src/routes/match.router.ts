import { validateRequest } from "@repo/common";
import { Request, Response, Router } from "express";
import "reflect-metadata";
import { container } from "tsyringe";
import MatchController from "../controllers/match.controller";
import FlagController from "../controllers/flag.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { listMatchesValidator } from "../validators";
import { Server as SocketIOServer } from "socket.io";

const router = Router();
// GET /matches
router.get("/matches", requireAuth, listMatchesValidator(), validateRequest, async (req: Request, res: Response) => {
  const controller = container.resolve(MatchController);
  return controller.getAllMatches(req, res);
});

router.get("/matches/:id", listMatchesValidator(), validateRequest, async (req: Request, res: Response) => {
  const controller = container.resolve(MatchController);
  return controller.getMatchById(req, res);
});

// GET /matches/:id/team-data - Get team data from Roanuz API
router.get("/matches/:id/team-data", async (req: Request, res: Response) => {
  const controller = container.resolve(MatchController);
  return controller.getMatchTeamData(req, res);
});

// PATCH /matches/:id
router.patch("/matches/:id", validateRequest, async (req: Request, res: Response) => {
  const controller = container.resolve(MatchController);
  return controller.updateMatch(req, res);
});

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

export default router;