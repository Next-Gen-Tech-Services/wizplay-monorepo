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

      const limit = Number(req.query.limit ?? 20);
      const offset = Number(req.query.offset ?? 0);

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

  /* questions */
  public async createQuestion(req: Request, res: Response) {
    const payload = req.body;
    const q = await this.contestService.createQuestion(payload);
    return res.status(STATUS_CODE.SUCCESS).json({ success: true, data: q });
  }

  public async listQuestions(req: Request, res: Response) {
    const contestId = req.params.contestId || req.query.contestId;
    const items = await this.contestService.listQuestions(String(contestId));
    return res.status(STATUS_CODE.SUCCESS).json({ success: true, data: items });
  }

  public async deleteQuestion(req: Request, res: Response) {
    const id = req.params.id;
    const ok = await this.contestService.deleteQuestion(id);
    return res.status(STATUS_CODE.SUCCESS).json({ success: true, data: ok });
  }
}
