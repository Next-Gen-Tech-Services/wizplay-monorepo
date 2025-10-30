import { validateRequest } from "@repo/common";
import { Request, Response, Router } from "express";
import "reflect-metadata";
import { container } from "tsyringe";
import MatchController from "../controllers/match.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { listMatchesValidator } from "../validators";
import { Server as SocketIOServer } from "socket.io";

const router = Router();
// const controller: MatchController = container.resolve(MatchController);
const sseClients: Array<{ id: string; matchId: string; res: Response }> = [];
// GET /matches
router.get("/matches", requireAuth, listMatchesValidator(), validateRequest, async (req:Request, res:Response) => {
  const controller = container.resolve(MatchController);
  return controller.getAllMatches(req, res);
});

// PATCH /matches/:id
router.patch("/matches/:id", validateRequest, async (req:Request, res:Response) => {
  const controller = container.resolve(MatchController);
  return controller.updateMatch(req, res);
});

// POST /livematch webhook
router.post("/matches/livematch", async (req:Request, res:Response) => {
  const controller = container.resolve(MatchController);
  return controller.liveMatchData(req, res);
});

// subscribe/unsubscribe
router.post("/matches/subscribe/:id", async (req:Request, res:Response) => {
  const controller = container.resolve(MatchController);
  return controller.subscribeMatch(req, res);
});
router.post("/matches/unsubscribe/:id", async (req:Request, res:Response) => {
  const controller = container.resolve(MatchController);
  return controller.unsubscribeMatch(req, res);
});

export default router;