// src/routes/contest.routes.ts
import { validateRequest } from "@repo/common";
import { Request, Response, Router } from "express";
import "reflect-metadata";
import { container } from "tsyringe";
import ContestController from "../controllers/contest.controller";
import { generateQuestionsValidator } from "../validators";

const router = Router();
const contestController: ContestController =
  container.resolve(ContestController);

/**
 * Contests
 */
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

router.get("/contests", async (req, res) => {
  const result = await contestController.listByMatch(req, res);
  return result;
});

/**
 * Questions
 */
router.post("/contests/questions", async (req, res) => {
  const result = await contestController.createQuestion(req, res);
  return result;
});

router.get("/contests/:contestId/questions", async (req, res) => {
  const result = await contestController.listQuestions(req, res);
  return result;
});

router.delete("/contests/questions/:id", async (req, res) => {
  const result = await contestController.deleteQuestion(req, res);
  return result;
});

/**
 * Generative AI
 */

router.post(
  "/contests/ai/generate",
  generateQuestionsValidator(),
  validateRequest,
  async (req: Request, res: Response) => {
    const result = await contestController.generateQuestions(req, res);
    return result;
  }
);

export default router;
