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
      const type = String(req.query.type ?? "")
        .trim()
        .toLowerCase();
      const statusFilter =
        type === "all" ? undefined : ["upcoming", "live", "joining_closed"];

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
    const userId = req.userId;

    // Check if this is an internal call (from the internal route)
    const isInternalCall = req.route?.path?.includes("/internal/");

    let c;
    if (isInternalCall) {
      // For internal calls, include match data
      c = await this.contestService.getContestWithMatchData(id);
    } else {
      // For regular calls, use the normal method
      c = await this.contestService.getContest(id, userId);
    }

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

      if (err?.code === "ALREADY_SUBMITTED") {
        return res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message:
            err.message ||
            "User has already submitted answers for this contest",
        });
      }

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
        .json({
          success: false,
          message: err.message || "Failed to fetch user contest history",
        });
    }
  }

  public async getUserJoinedContestsByMatchStatus(req: Request, res: Response) {
    const userId = req.userId;

    logger.debug(`User ID from request: ${userId}`);
    if (!userId) {
      return res
        .status(STATUS_CODE.BAD_REQUEST)
        .json({ success: false, message: "userId is required" });
    }

    try {
      const result =
        await this.contestService!.getUserJoinedContestsByMatchStatus(userId);

      return res
        .status(STATUS_CODE.SUCCESS)
        .json({ success: true, data: result });
    } catch (err: any) {
      logger.error(
        `ContestController.getUserJoinedContestsByMatchStatus error: ${err?.message ?? err}`
      );

      return res
        .status(STATUS_CODE.INTERNAL_SERVER)
        .json({
          success: false,
          message:
            err.message ||
            "Failed to fetch user joined contests by match status",
        });
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
      logger.error(
        `ContestController.getContestStats error: ${err?.message ?? err}`
      );
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
    const { matchData, liveData, question } = req.body;

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
    } catch (err: any) {
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

      logger.info(
        `[CONTEST-STATUS-API] Received request to update statuses for match: ${matchId}`
      );
      logger.info(
        `[CONTEST-STATUS-API] Live data: ${JSON.stringify(liveMatchData)}`
      );

      // 1. Get all contests for this match
      const contests = await this.contestService.getContestsByMatchId(matchId);

      if (!contests || contests.length === 0) {
        logger.info(
          `[CONTEST-STATUS-API] No contests found for match: ${matchId}`
        );
        return res.status(STATUS_CODE.SUCCESS).json({
          success: true,
          data: {
            message: "No contests found for this match",
            matchId,
            updatedCount: 0,
          },
          errors: null,
          timestamp: new Date().toISOString(),
        });
      }

      logger.info(
        `[CONTEST-STATUS-API] Found ${contests.length} contests to process`
      );

      const updatedContests = [];
      const contestsMovedToCalculating = [];

      // 2 & 3. Process each contest and determine new status
      for (const contest of contests) {
        try {
          const oldStatus = contest.status;

          // Skip if already completed or cancelled
          if (oldStatus === "completed" || oldStatus === "cancelled") {
            continue;
          }

          // Determine new status based on live data and contest type
          const newStatus = await this.contestService.determineContestStatus(
            contest,
            liveMatchData
          );

          // Update status if changed
          if (newStatus && newStatus !== oldStatus) {
            await this.contestService.updateContestStatus(
              contest.id,
              newStatus
            );

            updatedContests.push({
              contestId: contest.id,
              title: contest.title,
              type: contest.type,
              oldStatus,
              newStatus,
            });

            logger.info(
              `[CONTEST-STATUS-API] Updated contest ${contest.id} (${contest.type}): ${oldStatus} → ${newStatus}`
            );

            // Track contests that moved to calculating
            if (newStatus === "calculating") {
              contestsMovedToCalculating.push(contest);
            }
          }
        } catch (err: any) {
          logger.error(
            `[CONTEST-STATUS-API] Error updating contest ${contest.id}: ${err?.message || err}`
          );
        }
      }

      // 4. Fetch all contests currently in "calculating" status for this match
      // This includes both newly moved contests and any previously stuck contests
      const allCalculatingContests =
        await this.contestService.getContestsByMatchId(matchId);
      const calculatingContests = allCalculatingContests.filter(
        (c) => c.status === "calculating"
      );

      logger.info(
        `[CONTEST-STATUS-API] Found ${calculatingContests.length} total contests in calculating status (${contestsMovedToCalculating.length} just moved, ${calculatingContests.length - contestsMovedToCalculating.length} already calculating)`
      );

      // 5. Generate answers and calculate scores for ALL contests in "calculating" status

      for (const contest of calculatingContests) {
        try {
          logger.info(
            `[CONTEST-STATUS-API] Processing calculation for contest ${contest.id} (${contest.type})`
          );

          // Generate answers and calculate scores
          await this.contestService.processContestCalculation(
            contest.id,
            matchId,
            liveMatchData
          );

          logger.info(
            `[CONTEST-STATUS-API] ✅ Completed calculation for contest ${contest.id}`
          );
        } catch (err: any) {
          logger.error(
            `[CONTEST-STATUS-API] ❌ Error calculating contest ${contest.id}: ${err?.message || err}`
          );
          logger.error(
            `[CONTEST-STATUS-API] Error stack: ${err?.stack || "No stack trace"}`
          );
        }
      }

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        data: {
          matchId,
          updatedCount: updatedContests.length,
          calculatedCount: calculatingContests.length,
          updatedContests,
        },
        message: `Updated ${updatedContests.length} contest(s), calculated ${calculatingContests.length} contest(s)`,
        errors: null,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      logger.error(
        `ContestController.updateContestStatuses error: ${err?.message ?? err}`
      );
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        data: null,
        message: err?.message || "Failed to update contest statuses",
        errors: null,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Force complete stuck contests in calculating status
   * GET /contests/force-complete-stuck?matchId=xxx (optional)
   */
  public async forceCompleteStuck(req: Request, res: Response) {
    try {
      const matchId = req.query.matchId as string | undefined;

      logger.info(
        `[CONTEST-CONTROLLER] Force completing stuck contests${matchId ? ` for match ${matchId}` : ""}`
      );

      const result =
        await this.contestService.forceCompleteStuckContests(matchId);

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        data: result,
        message: `Fixed ${result.fixed} stuck contest(s)`,
        errors: null,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      logger.error(
        `ContestController.forceCompleteStuck error: ${err?.message ?? err}`
      );
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        data: null,
        message: err?.message || "Failed to force complete stuck contests",
        errors: null,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Move contests to calculating status when match is completed
   * POST /contests/match-completed/:matchId
   */
  public async handleMatchCompleted(req: Request, res: Response) {
    try {
      const { matchId } = req.params;

      if (!matchId) {
        return res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: "matchId is required",
          timestamp: new Date().toISOString(),
        });
      }

      logger.info(
        `[CONTEST-CONTROLLER] Handling match completion for match ${matchId}`
      );

      const result =
        await this.contestService.moveContestsToCalculating(matchId);

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        data: result,
        message: `Moved ${result.updated} contest(s) to calculating status`,
        errors: null,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      logger.error(
        `ContestController.handleMatchCompleted error: ${err?.message ?? err}`
      );
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        data: null,
        message: err?.message || "Failed to handle match completion",
        errors: null,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Manually complete stuck contests in calculating status
   * POST /contests/complete-calculating/:matchId
   */
  public async completeCalculatingContests(req: Request, res: Response) {
    try {
      const { matchId } = req.params;

      if (!matchId) {
        return res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: "matchId is required",
          timestamp: new Date().toISOString(),
        });
      }

      logger.info(
        `[CONTEST-CONTROLLER] Manually completing calculating contests for match ${matchId}`
      );

      const result =
        await this.contestService.completeCalculatingContests(matchId);

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        data: result,
        message: `Completed ${result.completed} contest(s)`,
        errors: null,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      logger.error(
        `ContestController.completeCalculatingContests error: ${err?.message ?? err}`
      );
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        data: null,
        message: err?.message || "Failed to complete calculating contests",
        errors: null,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get users who joined contests for a specific match (internal endpoint)
   */
  public async getUsersJoinedForMatch(req: Request, res: Response) {
    try {
      const { matchId } = req.params;

      if (!matchId) {
        return res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: "matchId is required",
          errors: null,
          timestamp: new Date().toISOString(),
        });
      }

      logger.info(
        `[CONTEST-USERS-FOR-MATCH] Getting joined users for match: ${matchId}`
      );

      const userIds = await this.contestService.getUsersJoinedForMatch(matchId);

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        data: { userIds, count: userIds.length },
        message: "Users retrieved successfully",
        errors: null,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      logger.error(
        `ContestController.getUsersJoinedForMatch error: ${err?.message ?? err}`
      );
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        data: null,
        message: err?.message || "Failed to get users for match",
        errors: null,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
