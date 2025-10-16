import { STATUS_CODE, logger } from "@repo/common";
import { Request, Response } from "express";
import { autoInjectable } from "tsyringe";
import SubmissionService from "../services/submission.service";

@autoInjectable()
export default class SubmissionController {
  constructor(private submissionService?: SubmissionService) {}

  public async submitAnswers(req: Request, res: Response) {
    try {
      const payload = {
        userId: req.body.userId,
        contestId: req.body.contestId,
        answers: req.body.answers,
        revealCorrect: Boolean(req.body.revealCorrect),
        treatNullAnsKeyAsUnscored: Boolean(req.body.treatNullAnsKeyAsUnscored),
      };
      const result = await this.submissionService!.submitAnswers(payload);
      return res
        .status(STATUS_CODE.SUCCESS)
        .json({ success: true, data: result });
    } catch (err: any) {
      logger.error(
        `SubmissionController.submitAnswers error: ${err?.message ?? err}`
      );
      return res
        .status(STATUS_CODE.BAD_REQUEST)
        .json({ success: false, message: err?.message ?? "Invalid request" });
    }
  }

  public async listUserSubmissions(req: Request, res: Response) {
    try {
      const userId = req.params.userId;
      const limit = Number(req.query.limit ?? 50);
      const offset = Number(req.query.offset ?? 0);
      const rows = await this.submissionService!.listUserSubmissions(
        userId,
        limit,
        offset
      );
      return res
        .status(STATUS_CODE.SUCCESS)
        .json({ success: true, data: rows });
    } catch (err: any) {
      logger.error(
        `SubmissionController.listUserSubmissions error: ${err?.message ?? err}`
      );
      return res
        .status(STATUS_CODE.INTERNAL_SERVER)
        .json({ success: false, message: "Server error" });
    }
  }

  public async getSubmission(req: Request, res: Response) {
    try {
      const id = req.params.id;
      const row = await this.submissionService!.getSubmissionById(id);
      if (!row)
        return res
          .status(STATUS_CODE.NOT_FOUND)
          .json({ success: false, message: "Submission not found" });
      return res.status(STATUS_CODE.SUCCESS).json({ success: true, data: row });
    } catch (err: any) {
      logger.error(
        `SubmissionController.getSubmission error: ${err?.message ?? err}`
      );
      return res
        .status(STATUS_CODE.INTERNAL_SERVER)
        .json({ success: false, message: "Server error" });
    }
  }

  public async getContestSubmission(req: Request, res: Response) {
    try {
      const id = req.params.id;
      const userId = req.userId;
      const row = await this.submissionService!.getContestSubmissionById(
        userId,
        id
      );
      if (!row)
        return res
          .status(STATUS_CODE.INTERNAL_SERVER)
          .json({ success: false, message: "Submission not found" });
      return res.status(STATUS_CODE.SUCCESS).json({ success: true, data: row });
    } catch (err: any) {
      logger.error(
        `SubmissionController.getSubmission error: ${err?.message ?? err}`
      );
      return res
        .status(STATUS_CODE.INTERNAL_SERVER)
        .json({ success: false, message: "Server error" });
    }
  }
}
