import { Router } from "express";
import "reflect-metadata";
import { container } from "tsyringe";
import SubmissionController from "../controllers/submission.controller";

const router = Router();
const submissionController: SubmissionController =
  container.resolve(SubmissionController);

router.post("/contests/submit", async (req, res) =>
  submissionController.submitAnswers(req, res)
);
router.get("/contests/submissions/user/:userId", async (req, res) =>
  submissionController.listUserSubmissions(req, res)
);
router.get("/contests/submissions/:id", async (req, res) =>
  submissionController.getSubmission(req, res)
);

export default router;
