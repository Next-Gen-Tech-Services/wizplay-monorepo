// src/routes/contest.routes.ts
import { Router } from "express";
import "reflect-metadata";
import { container } from "tsyringe";
import QuestionController from "../controllers/question.controller";

const router = Router();
const questionController: QuestionController =
  container.resolve(QuestionController);

router.post("/questions", async (req, res) => {
  const result = await questionController.createQuestion(req, res);
  return result;
});

router.get("/questions", async (req, res) => {
  const result = await questionController.listQuestions(req, res);
  return result;
});

router.patch("/questions/:id", async (req, res) => {
  const result = await questionController.updateQuestion(req, res);
  return result;
});

router.delete("/questions/:id", async (req, res) => {
  const result = await questionController.deleteQuestion(req, res);
  return result;
});

export default router;
