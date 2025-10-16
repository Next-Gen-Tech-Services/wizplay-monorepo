import { Router } from "express";
import "reflect-metadata";
import { container } from "tsyringe";
import SubmissionController from "../controllers/submission.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();
const submissionController: SubmissionController =
  container.resolve(SubmissionController);

router.post("/questions/submit", async (req, res) =>
  submissionController.submitAnswers(req, res)
);
router.get(
  "/questions/submissions/user/:userId",
  requireAuth,
  async (req, res) => submissionController.listUserSubmissions(req, res)
);
router.get("/questions/submissions/:id", async (req, res) =>
  submissionController.getSubmission(req, res)
);

router.get(
  "/questions/submissions/contest/:id",
  requireAuth,
  async (req, res) => submissionController.getContestSubmission(req, res)
);

export default router;
