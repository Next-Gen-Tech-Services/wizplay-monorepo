// src/controllers/question.controller.ts
import { STATUS_CODE } from "@repo/common";
import { Request, Response } from "express";
import { autoInjectable } from "tsyringe";
import QuestionService from "../services/question.service";

@autoInjectable()
export default class QuestionController {
  constructor(private readonly questionService: QuestionService) {}

  public async createQuestion(req: Request, res: Response) {
    const payload = req.body;
    const q = await this.questionService.createQuestion(payload);
    return res.status(STATUS_CODE.SUCCESS).json({ success: true, data: q });
  }

  public async listQuestions(req: Request, res: Response) {
    try {
      const contestId = (req.query.contestId as string) || undefined;

      // parse and sanitize pagination params
      const rawLimit = Number(req.query.limit ?? 20);
      const rawOffset = Number(req.query.offset ?? 0);
      const limit =
        Number.isFinite(rawLimit) && rawLimit > 0
          ? Math.min(100, Math.floor(rawLimit))
          : 20;
      const offset =
        Number.isFinite(rawOffset) && rawOffset >= 0
          ? Math.floor(rawOffset)
          : 0;

      // call service which returns { items, total }
      const result = await this.questionService.listQuestions(
        contestId,
        limit,
        offset
      );

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        data: { items: result.items, total: result.total },
      });
    } catch (err: any) {
      logger.error(`listQuestions controller error: ${err?.message ?? err}`);
      return res
        .status(STATUS_CODE.INTERNAL_SERVER)
        .json({ success: false, message: "Failed to list questions" });
    }
  }

  public async updateQuestion(req: Request, res: Response) {
    try {
      const id = req.params.id;
      const updates = req.body; // may include ansKey, points, status etc.
      const q = await this.questionService.updateQuestion(id, updates);
      if (!q) {
        return res
          .status(STATUS_CODE.NOT_FOUND)
          .json({ success: false, message: "Question not found" });
      }
      return res.status(STATUS_CODE.SUCCESS).json({ success: true, data: q });
    } catch (err: any) {
      logger.error(`updateQuestion controller error: ${err?.message ?? err}`);
      return res
        .status(STATUS_CODE.INTERNAL_SERVER)
        .json({ success: false, message: "Failed to update question" });
    }
  }

  public async deleteQuestion(req: Request, res: Response) {
    const id = req.params.id;
    const ok = await this.questionService.deleteQuestion(id);
    return res.status(STATUS_CODE.SUCCESS).json({ success: true, data: ok });
  }
}
