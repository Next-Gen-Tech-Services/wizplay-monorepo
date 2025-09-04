import { logger, STATUS_CODE } from "@repo/common";
import { Request, Response } from "express";
import "tsyringe";
import { autoInjectable } from "tsyringe";
import MatchService from "../services/match.service";

@autoInjectable()
export default class MatchController {
  constructor(private readonly svc?: MatchService) {}

  public async getAll(req: Request, res: Response) {
    const data = await this.svc!.getAll(req.query as any);
    logger.info(
      "Request ID:" + req.headers["x-request-id"] + " | message: matches list"
    );
    return res.status(STATUS_CODE.SUCCESS).json({
      success: true,
      message: "matches",
      data,
      errors: null,
      timestamp: new Date().toISOString(),
    });
  }

  public async getById(req: Request, res: Response) {
    try {
      const item = await this.svc!.getByMatchKey(req.params.match_key);
      logger.info(
        "Request ID:" + req.headers["x-request-id"] + " | message: match found"
      );
      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        message: "match",
        data: item,
        errors: null,
        timestamp: new Date().toISOString(),
      });
    } catch (e: any) {
      const code = e?.statusCode || STATUS_CODE.NOT_FOUND;
      return res.status(code).json({
        success: false,
        message: e?.message || "Match not found",
        data: null,
        errors: null,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
