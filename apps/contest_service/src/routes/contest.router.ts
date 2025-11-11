// src/routes/contest.routes.ts
import { validateRequest } from "@repo/common";
import timeout from "connect-timeout";
import { Request, Response, Router } from "express";
import "reflect-metadata";
import { container } from "tsyringe";
import ContestController from "../controllers/contest.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { generateQuestionsValidator } from "../validators";

const router = Router();
const contestController: ContestController =
  container.resolve(ContestController);

/**
 * Contests
 */

// Stats endpoint for analytics dashboard
router.get("/contests/stats", async (req, res) => {
  const result = await contestController.getContestStats(req, res);
  return result;
});

router.get("/contests", requireAuth, async (req, res) => {
  const result = await contestController.listByMatch(req, res);
  return result;
});

router.post("/contests", async (req, res) => {
  const result = await contestController.createContest(req, res);
  return result;
});

router.get("/contests/:id", async (req, res) => {
  const result = await contestController.getContest(req, res);
  return result;
});

router.patch("/contests/:id", async (req, res) => {
  const result = await contestController.updateContest(req, res);
  return result;
});

router.delete("/contests/:id", async (req, res) => {
  const result = await contestController.deleteContest(req, res);
  return result;
});

/**
 * User Contests
 */

router.post(
  "/contests/join",
  requireAuth,
  async (req: Request, res: Response) => {
    const result = await contestController.joinContest(req, res);
    return result;
  }
);

router.get(
  "/contests/join/:userId",
  requireAuth,
  async (req: Request, res: Response) => {
    const result = await contestController.userContest(req, res);
    return result;
  }
);

/**
 * Generative AI
 */

router.post("/contests/generate", async (req: Request, res: Response) => {
  // Set timeout to 3 minutes for AI generation
  req.setTimeout(180000); // 3 minutes
  res.setTimeout(180000); // 3 minutes
  
  const result = await contestController.generateContests(req, res);
  return result;
});

router.post(
  "/contests/generate/questions",
  generateQuestionsValidator(),
  validateRequest,
  async (req: Request, res: Response) => {
    const result = await contestController.generateQuestions(req, res);
    return result;
  }
);

export default router;
