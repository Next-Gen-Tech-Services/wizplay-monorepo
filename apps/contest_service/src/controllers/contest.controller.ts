// src/controllers/contest.controller.ts
import { logger, STATUS_CODE } from "@repo/common";
import { Request, Response } from "express";
import { autoInjectable } from "tsyringe";
import ContestService from "../services/contest.service";
import contestStatusService from "../services/contest-status.service";

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

  // Internal endpoint for service-to-service communication (no auth)
  public async getActiveContestsByMatch(req: Request, res: Response) {
    try {
      const matchId = req.params.matchId;
      
      if (!matchId) {
        return res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: "matchId is required",
        });
      }

      // Get only scheduled contests for this match
      const result = await this.contestService.listContests(
        matchId,
        1000, // high limit to get all
        0,
        undefined // no userId needed for internal calls
      );

      // Filter to only scheduled status
      const scheduledContests = result.items.filter(
        (contest: any) => contest.status === "upcoming"
      );

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        data: scheduledContests,
      });
    } catch (err: any) {
      logger.error(`Error fetching active contests: ${err.message ?? err}`);
      return res.status(500).json({
        success: false,
        message: err.message ?? "Internal server error",
      });
    }
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

      // Status filter: by default show only upcoming and live contests
      // If type=all, show all contests
      const type = String(req.query.type ?? "").trim().toLowerCase();
      const statusFilter = type === "all" ? undefined : ["upcoming", "live"];

      const result = await this.contestService.listContests(
        matchId,
        limit,
        offset,
        req.userId,
        statusFilter
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
    // forward authorization header to downstream services (wallet)
    const authHeader = req.headers.authorization as string | undefined;

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
        authHeader,
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

  public async userContest(req: Request, res: Response) {
    const { userId } = req.params;

    if (!userId) {
      return res
        .status(STATUS_CODE.BAD_REQUEST)
        .json({ success: false, message: "userId is required" });
    }

    try {
      const result = await this.contestService!.userContest(userId);

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

  public async getUserContestHistory(req: Request, res: Response) {
    const { userId } = req.params;

    if (!userId) {
      return res
        .status(STATUS_CODE.BAD_REQUEST)
        .json({ success: false, message: "userId is required" });
    }

    try {
      const result = await this.contestService!.getUserContestHistory(userId);

      return res
        .status(STATUS_CODE.SUCCESS)
        .json({ success: true, data: result });
    } catch (err: any) {
      logger.error(
        `ContestController.getUserContestHistory error: ${err?.message ?? err}`
      );

      return res
        .status(STATUS_CODE.INTERNAL_SERVER)
        .json({ success: false, message: err.message || "Failed to fetch user contest history" });
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

  public async getContestStats(req: Request, res: Response) {
    try {
      const stats = await this.contestService.getContestStats();

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        data: stats,
        message: "Contest statistics fetched successfully",
        errors: null,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      logger.error(`ContestController.getContestStats error: ${err?.message ?? err}`);
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        data: null,
        message: err?.message || "Failed to fetch contest statistics",
        errors: null,
        timestamp: new Date().toISOString(),
      });
    }
  }

  public async generateAnswers(req: Request, res: Response) {
    const { matchData, liveData,question } = req.body;
    
    try {
      const result = await this.contestService.generateAnswers(
        matchData,
        liveData,
        question
      );  
      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        data: result?.data,
        message: result?.message,
        errors: null,
        timestamp: new Date().toISOString(),
      });
    }

    catch (err: any) {
      return res.status(STATUS_CODE.BAD_REQUEST).json({
        success: false,
        data: null,
        message: err?.message || "Error generating answers",
        errors: null,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Update contest statuses based on live match data
   * Called from match_service livematch webhook
   */
  public async updateContestStatuses(req: Request, res: Response) {
    try {
      const { matchId, liveMatchData } = req.body;

      if (!matchId || !liveMatchData) {
        return res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: "matchId and liveMatchData are required",
          errors: null,
          timestamp: new Date().toISOString(),
        });
      }

      logger.info(`[CONTEST-STATUS-API] Received request to update statuses for match: ${matchId}`);

      const results = await contestStatusService.updateContestStatuses(
        matchId,
        liveMatchData
      );

      logger.info(`[CONTEST-STATUS-API] Successfully updated ${results.length} contest(s)`);

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        data: {
          updatedContests: results,
          count: results.length,
        },
        message: `Updated ${results.length} contest(s)`,
        errors: null,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      logger.error(`ContestController.updateContestStatuses error: ${err?.message ?? err}`);
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        data: null,
        message: err?.message || "Failed to update contest statuses",
        errors: null,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
