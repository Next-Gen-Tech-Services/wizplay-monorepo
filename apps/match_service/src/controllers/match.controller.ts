import { STATUS_CODE } from "@repo/common";
import { Request, Response } from "express";
import "tsyringe";
import { autoInjectable } from "tsyringe";
import MatchService from "../services/match.service";

@autoInjectable()
export default class MatchController {
  constructor(private readonly matchService: MatchService) {}

  public async getAllMatches(req: Request, res: Response) {
    const queryParams = req.query;
    const result =
      await this.matchService.fetchAllMatchesWithFilters(queryParams);

    return res.status(STATUS_CODE.SUCCESS).json({
      success: true,
      message: "matches fetched successfully",
      data: result,
      errors: null,
      timestamp: new Date().toISOString(),
    });
  }
}
