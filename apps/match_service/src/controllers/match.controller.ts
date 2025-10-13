import { STATUS_CODE } from "@repo/common";
import { Request, Response } from "express";
import "tsyringe";
import { autoInjectable } from "tsyringe";
import redis from "../configs/redis.config";
import MatchService from "../services/match.service";

@autoInjectable()
export default class MatchController {
  constructor(private readonly matchService: MatchService) {}

  public async getAllMatches(req: Request, res: Response) {
    const queryParams = req.query;
    const userId = req.userId;
    const result = await this.matchService.fetchAllMatchesWithFilters(
      queryParams,
      userId
    );

    return res.status(STATUS_CODE.SUCCESS).json({
      success: true,
      message: "matches fetched successfully",
      data: result,
      errors: null,
      timestamp: new Date().toISOString(),
    });
  }
  async updateMatch(req: Request, res: Response) {
    const { id } = req.params;
    const { showOnFrontend } = req.body;

    try {
      const result = await this.matchService.updateMatch(id, showOnFrontend);
      return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      // better error mapping with your STATUS_CODE if available
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async subscribeMatch(req: Request, res: Response) {
    const { matchId } = req.params;
    const token = await redis.getter("roanuzToken");
    logger.info(`matchID: ${matchId} `);
    try {
      const result = await this.matchService.subscribeMatch(matchId, token);
      return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      // better error mapping with your STATUS_CODE if available
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async unsubscribeMatch(req: Request, res: Response) {
    const { matchId } = req.params;
    const token = await redis.getter("roanuzToken");
    logger.info(`matchID: ${matchId} `);
    try {
      const result = await this.matchService.unsubscribeMatch(matchId, token);
      return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      // better error mapping with your STATUS_CODE if available
      return res.status(500).json({ success: false, message: err.message });
    }
  }
}
