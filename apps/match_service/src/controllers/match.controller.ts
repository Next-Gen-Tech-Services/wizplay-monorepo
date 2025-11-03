import { STATUS_CODE } from "@repo/common";
import { Request, Response } from "express";
import "reflect-metadata";
import "tsyringe";
import { autoInjectable, inject } from "tsyringe";
import { Server as SocketIOServer } from "socket.io";
import MatchService from "../services/match.service";
import MatchLiveRepository from "../repositories/matchLive.repository";
import { MatchLiveEventType } from "../models/matchLiveEvent.model";
import redis from "../configs/redis.config";
import zlib from "zlib";
import transformMatch from "../utils/transformLiveMatchData";

const lastSeen: Record<string, string | number> = {};

@autoInjectable()
export default class MatchController {
  private liveRepo: MatchLiveRepository;

  constructor(private readonly matchService: MatchService, @inject("SocketIO") private readonly io?: SocketIOServer) {
    this.liveRepo = new MatchLiveRepository();
  }

  // small broadcast helper: sockets + SSE
  private broadcast(matchId: string, event: string, payload: any) {
    // 1) socket.io (if available)
    try {
      if (this.io && matchId) {
        this.io.to(matchId).emit(event, payload);
        // optionally emit global:
        this.io.to("live_all").emit(event, payload);
      }
    } catch (e) {
      console.warn("Socket emit failed", e);
    }


  }

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

  public async getMatchById(req: Request, res: Response) {
    const matchId = req.params.id;
    
    const result = await this.matchService.fetchMatchById(matchId);
    return res.status(STATUS_CODE.SUCCESS).json({
      success: true,
      message: "match fetched successfully",
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
    const { id } = req.params;
    const { token } = req.body;
    // const token = await redis.getter("roanuzToken");
    console.log(`matchID: ${id} token: ${token}`);
    try {
      const result = await this.matchService.subscribeMatch(id, token);
      return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      // better error mapping with your STATUS_CODE if available
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async unsubscribeMatch(req: Request, res: Response) {
    const { id } = req.params;
    const { token } = req.body;
    // const token = await redis.getter("roanuzToken");
    console.log(`id: ${id} `);
    try {
      const result = await this.matchService.unsubscribeMatch(id, token);
      return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      // better error mapping with your STATUS_CODE if available
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async getMatchTeamData(req: Request, res: Response) {
    const { id } = req.params;
    console.log(`Fetching team data for matchId: ${id}`);
    try {
      const result = await this.matchService.getMatchTeamData(id);
      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        message: "Match team data fetched successfully",
        data: result,
        errors: null,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        message: err.message,
        data: null,
        errors: [err.message],
        timestamp: new Date().toISOString(),
      });
    }
  }

  async liveMatchData(req: Request, res: Response) {
    try {
      const chunks: Buffer[] = [];

      // collect raw body
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", async () => {
        const buffer = Buffer.concat(chunks);

        // gunzip
        zlib.gunzip(buffer, async (err, decoded) => {
          if (err) {
            console.error("Error decompressing gzip:", err);
            return res.status(400).send("Invalid gzip data");
          }

          const jsonStr = decoded.toString("utf8");
          const raw = JSON.parse(jsonStr);

          // transform
          const cleaned = transformMatch(raw);
          const matchId = cleaned.match_id || "unknown";

          const eventKey = cleaned?.__meta?.last_ball_key || cleaned.updated_at.epoch_s;
          const last = lastSeen[matchId];
          if (last && eventKey && String(last) === String(eventKey)) {
            // duplicate event: acknowledge but do not re-broadcast
            return res.status(200).send({ ok: true, dedup: true });
          }
          // save last seen key
          if (eventKey) lastSeen[matchId] = eventKey;

          // Store in Redis (fast, temporary cache - 10 minutes TTL)
          try {
            await redis.setter(
              `match:${matchId}:live`,
              JSON.stringify(cleaned)
            );
          } catch (redisErr) {
            console.error("Redis storage error:", redisErr);
          }

          // Store in Database (async, don't block webhook response)
          this.storeLiveMatchData(matchId, cleaned).catch((dbErr) => {
            console.error("Database storage error:", dbErr);
          });

          // broadcast to sockets and SSE clients
          this.broadcast(matchId, "match_update", cleaned);

          // respond to webhook provider quickly
          res.status(200).send({ ok: true });
        });
      });
    } catch (err: any) {
      console.error("Webhook processing error:", err);
      res.status(500).send({ error: "Internal server error" });
    }
  }

  // Store live match data in database
  private async storeLiveMatchData(matchId: string, data: any): Promise<void> {
    try {
      // 1. Update current live state (UPSERT)
      await this.liveRepo.upsertLiveState({
        matchId,
        currentScore: {
          runs: data.score?.runs || 0,
          wickets: data.score?.wickets || 0,
          overs: data.score?.overs || 0,
          runRate: data.score?.run_rate || 0,
          target: data.target || null,
          battingTeam: data.batting_team || null,
          bowlingTeam: data.bowling_team || null,
          striker: data.striker || null,
          nonStriker: data.non_striker || null,
          bowler: data.bowler || null,
        },
        lastBallKey: data.last_ball_key || null,
        inningsIndex: data.innings_index || null,
        battingTeam: data.batting_team || null,
        bowlingTeam: data.bowling_team || null,
      });

      // 2. Determine if this is a key event and store it
      const eventType = this.determineEventType(data);

      if (eventType) {
        await this.liveRepo.createLiveEvent({
          matchId,
          eventType,
          eventData: {
            batsman: data.batsman || null,
            bowler: data.bowler || null,
            score: data.score || null,
            ballKey: data.last_ball_key || null,
            commentary: data.commentary || null,
            isWicket: data.is_wicket || false,
            isBoundary: data.is_boundary || false,
            runs: data.runs || 0,
            wicketType: data.wicket_type || null,
            fielder: data.fielder || null,
          },
          ballKey: data.last_ball_key || null,
          timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
        });
      }
    } catch (error: any) {
      console.error(`Failed to store live match data for ${matchId}:`, error?.message || error);
      // Don't throw - we don't want to break webhook processing
    }
  }

  // Determine if this update is a key event worth storing
  private determineEventType(data: any): MatchLiveEventType | null {
    if (data.is_wicket) return "wicket";
    if (data.is_boundary && (data.runs === 6 || data.runs === 4)) return "boundary";
    if (data.is_over_complete) return "over_complete";
    if (data.is_innings_complete) return "innings_end";
    if (data.match_status === "completed") return "match_end";

    // Check milestones
    const batsmanRuns = data.batsman?.runs || 0;
    if (batsmanRuns === 50 || batsmanRuns === 100 || batsmanRuns === 150 || batsmanRuns === 200) {
      return "milestone";
    }

    return null; // Regular ball, don't store
  }

  // Get live score (from Redis or DB)
  async getLiveScore(req: Request, res: Response) {
    const matchId = req.params.id;

    try {
      // Try Redis first (fastest)
      const cached = await redis.getter(`match:${matchId}:live`);
      if (cached) {
        return res.status(STATUS_CODE.SUCCESS).json({
          success: true,
          data: JSON.parse(cached),
          source: "cache",
          timestamp: new Date().toISOString(),
        });
      }

      // Fallback to Database
      const dbState = await this.liveRepo.getCurrentLiveState(matchId);
      if (dbState) {
        return res.status(STATUS_CODE.SUCCESS).json({
          success: true,
          data: dbState,
          source: "database",
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(STATUS_CODE.NOT_FOUND).json({
        success: false,
        message: "No live data available for this match",
        data: null,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        message: err.message,
        data: null,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Get match events/commentary
  async getMatchEvents(req: Request, res: Response) {
    const matchId = req.params.id;
    const eventType = req.query.type as any;
    const limit = parseInt(req.query.limit as string) || 100;

    try {
      const events = await this.liveRepo.getMatchEvents(matchId, eventType, limit);

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        data: events,
        count: events.length,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        message: err.message,
        data: null,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Get match highlights (wickets + boundaries)
  async getMatchHighlights(req: Request, res: Response) {
    const matchId = req.params.id;

    try {
      const highlights = await this.liveRepo.getMatchHighlights(matchId);

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        data: highlights,
        count: highlights.length,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        message: err.message,
        data: null,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
