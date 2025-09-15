// src/routes/contest.routes.ts
import { Router } from "express";
import "reflect-metadata";
import { container } from "tsyringe";
import ContestController from "../controllers/contest.controller";

const router = Router();
const contestController: ContestController =
  container.resolve(ContestController);

/**
 * Contests
 */
router.post("/contests", (req, res) =>
  contestController.createContest(req, res)
);
router.get("/contests/:id", (req, res) =>
  contestController.getContest(req, res)
);
router.patch("/contests/:id", (req, res) =>
  contestController.updateContest(req, res)
);
router.delete("/contests/:id", (req, res) =>
  contestController.deleteContest(req, res)
);
router.get("/contests", (req, res) => contestController.listByMatch(req, res));

/**
 * Questions
 */
router.post("/contests/questions", (req, res) =>
  contestController.createQuestion(req, res)
);
router.get("/contests/:contestId/questions", (req, res) =>
  contestController.listQuestions(req, res)
);
router.delete("/contests/questions/:id", (req, res) =>
  contestController.deleteQuestion(req, res)
);

export default router;
