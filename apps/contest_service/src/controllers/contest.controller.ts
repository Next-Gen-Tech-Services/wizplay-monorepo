// src/controllers/contest.controller.ts
import { logger, STATUS_CODE } from "@repo/common";
import { Request, Response } from "express";
import { autoInjectable } from "tsyringe";
import ContestService from "../services/contest.service";

@autoInjectable()
export default class ContestController {
  constructor(private readonly contestService: ContestService) {}

  public async createContest(req: Request, res: Response) {
    const payload = req.body;
    const created = await this.contestService.createContest(payload);
    return res
      .status(STATUS_CODE.SUCCESS)
      .json({ success: true, data: created });
  }

  public async listByMatch(req: Request, res: Response) {
    try {
      // allow matchId via path param or query
      const matchId =
        String(req.params.matchId ?? req.query.matchId ?? "").trim() ||
        undefined;

      // parse limit/offset defensively (avoid NaN)
      const parsedLimit = Number(req.query.limit ?? 20);
      const parsedOffset = Number(req.query.offset ?? 0);

      const limit =
        Number.isFinite(parsedLimit) && parsedLimit > 0
          ? Math.min(1000, Math.floor(parsedLimit))
          : 20;
      const offset =
        Number.isFinite(parsedOffset) && parsedOffset >= 0
          ? Math.floor(parsedOffset)
          : 0;

      const result = await this.contestService.listContests(
        matchId,
        limit,
        offset
      );

      return res
        .status(STATUS_CODE.SUCCESS)
        .json({ success: true, data: result.items, total: result.total });
    } catch (err: any) {
      logger.error(
        `ContestController.listByMatch error: ${err?.message ?? err}`
      );
      return res
        .status(STATUS_CODE.INTERNAL_SERVER)
        .json({ success: false, message: "Server error" });
    }
  }

  public async getContest(req: Request, res: Response) {
    const id = req.params.id;
    const c = await this.contestService.getContest(id);
    return res.status(STATUS_CODE.SUCCESS).json({ success: true, data: c });
  }

  public async updateContest(req: Request, res: Response) {
    const id = req.params.id;
    const patch = req.body;
    const updated = await this.contestService.updateContest(id, patch);
    return res
      .status(STATUS_CODE.SUCCESS)
      .json({ success: true, data: updated });
  }

  public async deleteContest(req: Request, res: Response) {
    const id = req.params.id;
    const ok = await this.contestService.deleteContest(id);
    return res.status(STATUS_CODE.SUCCESS).json({ success: true, data: ok });
  }

  public async joinContest(req: Request, res: Response) {
    const { userId, contestId, matchId } = req.body;

    if (!userId || !contestId) {
      return res
        .status(STATUS_CODE.BAD_REQUEST)
        .json({ success: false, message: "userId and contestId are required" });
    }

    try {
      const result = await this.contestService!.joinContest({
        userId,
        contestId,
        matchId,
      });

      return res
        .status(STATUS_CODE.SUCCESS)
        .json({ success: true, message: "Contest joined", data: result });
    } catch (err: any) {
      logger.error(
        `ContestController.joinContest error: ${err?.message ?? err}`
      );

      if (err?.code === "CONFLICT") {
        return res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: err.message || "User already joined this contest",
        });
      }

      if (err?.code === "NOT_FOUND") {
        return res.status(STATUS_CODE.NOT_FOUND).json({
          success: false,
          message: err.message || "Contest not found",
        });
      }

      // fallback
      return res
        .status(STATUS_CODE.INTERNAL_SERVER)
        .json({ success: false, message: "Server error" });
    }
  }

  /** generative ai */

  public async generateQuestions(req: Request, res: Response) {
    const { matchData, contestDescription, contestId } = req.body;

    try {
      const result = await this.contestService.generateAIQuestions(
        matchData,
        contestDescription,
        contestId
      );

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        data: result?.data,
        message: result?.message,
        errors: null,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(STATUS_CODE.BAD_REQUEST).json({
        success: false,
        data: null,
        message: err?.message || "Error generating contest",
        errors: null,
        timestamp: new Date().toISOString(),
      });
    }
  }

  public async generateContests(req: Request, res: Response) {
    const { matchData } = req.body;

    try {
      const result = await this.contestService.generateContests(matchData);

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        data: result?.data,
        message: result?.message,
        errors: null,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(STATUS_CODE.BAD_REQUEST).json({
        success: false,
        data: null,
        message: err?.message || "Error generating contest",
        errors: null,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
