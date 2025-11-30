import { STATUS_CODE } from "@repo/common";
import { Request, Response } from "express";
import "reflect-metadata";
import "tsyringe";
import { autoInjectable, inject } from "tsyringe";
import { Server as SocketIOServer } from "socket.io";
import MatchService from "../services/match.service";
import MatchLiveRepository from "../repositories/matchLive.repository";
import { MatchLiveEventType } from "../models/matchLiveEvent.model";
import zlib from "zlib";
import { transformCricketMatch } from "../utils/transformLiveMatchData";
import fs from 'fs'
import redis from "../configs/redis.config";
import axios from "axios";
import ServerConfigs from "../configs/server.config";
import { generateApiToken } from "../utils/utils";
import { DB, IDatabase } from "../configs/database.config";
const lastSeen: Record<string, string | number> = {};

@autoInjectable()
export default class MatchController {
  private liveRepo: MatchLiveRepository;
  private _DB: IDatabase = DB;

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

  /**
   * Live Match Data Webhook
   * 
   * Receives real-time match updates from Roanuz API
   * Flow:
   * 1. Decompress gzipped JSON data
   * 2. Transform to internal format
   * 3. Store in Redis for quick access
   * 4. Update contest statuses based on live data
   * 5. Broadcast to WebSocket clients
   */
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
          let raw = JSON.parse(jsonStr);

          raw = transformCricketMatch(raw);
         
          const matchKey = raw.match.id; // This is actually the match key from Roanuz

          // Get the actual match UUID from database using the key
          const match = await this.matchService.getMatchByKey(matchKey);
          const matchId = match?.id;

          if (!matchId) {
            console.warn(`[WEBHOOK] Match not found in database for key: ${matchKey}`);
            return res.status(200).send({ ok: true, warning: "Match not found" });
          }

          // Fetch and store ball-by-ball data for answer generation
          // This will enhance raw data with ballByBallData field
          const enhancedData = await this.fetchAndStoreBallByBall(matchKey, raw);

          // push enhanced data inside redis for quick access (use key for Redis)
          // This now includes ballByBallData in the same object
          await redis.setInList(`${matchKey}:live_updates`, JSON.stringify(enhancedData));

          // Update contest statuses based on live match data (with enhanced ball-by-ball data for AI)
          // Pass enhancedData so AI can generate accurate answers using ball-by-ball data
          this.updateContestStatuses(matchId, enhancedData || raw).catch(err => {
            console.error("[CONTEST-STATUS] Error updating contest statuses:", err);
          });

          // broadcast to sockets and SSE clients (use key for socket rooms)
          this.broadcast(matchKey, "match_update", raw);

          // respond to webhook provider quickly
          res.status(200).send({ ok: true });
        });
      });
    } catch (err: any) {
      console.error("Webhook processing error:", err);
      res.status(500).send({ error: "Internal server error" });
    }
  }


  /**
   * Update contest statuses by calling contest_service API
   */
  private async updateContestStatuses(matchId: string, liveMatchData: any): Promise<void> {
    try {
      const contestServiceUrl = ServerConfigs.CONTEST_SERVICE_URL || "http://localhost:4005";

      console.log(`[CONTEST-STATUS] Calling contest service to update statuses for match: ${matchId}`);

      const response = await axios.post(
        `${contestServiceUrl}/api/v1/contests/update-status`,
        {
          matchId,
          liveMatchData
        },
        {
          timeout: 60000, // Increased to 60 seconds for AI processing
          headers: { "Content-Type": "application/json" }
        }
      );

      console.log(`[CONTEST-STATUS] Successfully updated contest statuses for match: ${matchId}`, response.data);
    } catch (error: any) {
      console.error(`[CONTEST-STATUS] Failed to update contest statuses for match ${matchId}:`, {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status
      });
      // Don't throw - we don't want to break webhook processing
    }
  }

  /**
   * Fetch and store ball-by-ball data from Roanuz API
   * This data is used for generating accurate answers for contests
   * Stores in both Redis and Database (LiveMatchData table)
   * 
   * Smart fetching: If there are missing overs, fetches all overs from last stored to current
   * Example: If last stored was over 4 and current is 7, fetches overs 5, 6, 7
   * 
   * @returns Enhanced live data with ballByBallData embedded
   */
  private async fetchAndStoreBallByBall(matchKey: string, liveData: any): Promise<any> {
    try {
      const token = await generateApiToken();
      if (!token) {
        console.warn("[BALL-BY-BALL] No Roanuz token found, skipping ball-by-ball fetch");
        return;
      }

      const projectKey = ServerConfigs.ROANUZ_PK;
      
      // Fetch the main endpoint to get current over ball-by-ball data
      const mainUrl = `https://api.sports.roanuz.com/v5/cricket/${projectKey}/match/${matchKey}/ball-by-ball/?token=${token}`;

      console.log(`[BALL-BY-BALL] Fetching current over data for match: ${matchKey}`);

      const response = await axios.get(mainUrl, {
        timeout: 10000,
        headers: { "Accept": "application/json" }
      });

      if (!response.data?.data?.over) {
        console.warn(`[BALL-BY-BALL] No over data in response for match: ${matchKey}`);
        return;
      }

      // Extract current over data
      const currentOverData = response.data.data.over;
      const inningsId = currentOverData.index?.innings;
      const currentOverNumber = currentOverData.index?.over_number;

      console.log(`[BALL-BY-BALL] Current over: ${currentOverNumber} of ${inningsId}`);

      // Get existing ball-by-ball data from the last live data entry
      let allOversData: any = {};
      
      const existingLiveData = await this.liveRepo.getCurrentLastdata(matchKey);
      if (existingLiveData?.simplifiedData?.ballByBallData) {
        allOversData = existingLiveData.simplifiedData.ballByBallData;
        console.log(`[BALL-BY-BALL] Found existing ball-by-ball data in database`);
      } else {
        console.log(`[BALL-BY-BALL] No existing ball-by-ball data, starting fresh`);
      }

      // Initialize innings if not exists
      if (!allOversData[inningsId]) {
        allOversData[inningsId] = { overs: {} };
      }

      // Find the last stored over number for this innings
      const storedOvers = Object.keys(allOversData[inningsId].overs || {}).map(Number);
      const lastStoredOver = storedOvers.length > 0 ? Math.max(...storedOvers) : 0;

      console.log(`[BALL-BY-BALL] Last stored over: ${lastStoredOver}, Current over: ${currentOverNumber}`);

      // Determine which overs to fetch
      const oversToFetch: number[] = [];
      
      if (currentOverNumber > lastStoredOver) {
        // Fetch all missing overs from (lastStoredOver + 1) to currentOverNumber
        for (let overNum = lastStoredOver + 1; overNum <= currentOverNumber; overNum++) {
          oversToFetch.push(overNum);
        }
      } else if (currentOverNumber === lastStoredOver) {
        // Update current over (might have new balls)
        oversToFetch.push(currentOverNumber);
      }

      console.log(`[BALL-BY-BALL] Fetching overs: ${oversToFetch.join(', ')} for ${inningsId}`);

      // Fetch each missing over
      for (const overNum of oversToFetch) {
        try {
          // Use the specific over endpoint: /ball-by-ball/{innings_id}_{over_number}/
          const overKey = `${inningsId}_${overNum}`;
          const overUrl = `https://api.sports.roanuz.com/v5/cricket/${projectKey}/match/${matchKey}/ball-by-ball/${overKey}/?token=${token}`;
          
          console.log(`[BALL-BY-BALL] Fetching over ${overNum}: ${overUrl}`);

          const overResponse = await axios.get(overUrl, {
            timeout: 8000,
            headers: { "Accept": "application/json" }
          });

          if (overResponse.data?.data?.over) {
            const fetchedOverData = overResponse.data.data.over;
            
            // Simplify over data - keep only essential information
            const simplifiedOverData = {
              innings: fetchedOverData.index?.innings,
              overNumber: fetchedOverData.index?.over_number,
              balls: (fetchedOverData.balls || []).map((ball: any) => ({
                repr: ball.repr, // Ball representation (r0, r1, b4, b6, w, etc.)
                runs: ball.team_score?.runs || 0,
                wickets: ball.team_score?.wickets || 0,
                isWicket: ball.team_score?.is_wicket || false,
                isFour: ball.batsman?.is_four || false,
                isSix: ball.batsman?.is_six || false,
                isDot: ball.batsman?.is_dot_ball || false,
                batsman: ball.batsman?.player_key,
                bowler: ball.bowler?.player_key,
                batsmanRuns: ball.batsman?.runs || 0,
                ballType: ball.ball_type, // normal, wide, no_ball, leg_bye, etc.
                extras: ball.team_score?.extras || 0
              })),
              totalRuns: fetchedOverData.balls?.reduce((sum: number, ball: any) => sum + (ball.team_score?.runs || 0), 0) || 0,
              totalWickets: fetchedOverData.balls?.filter((ball: any) => ball.team_score?.is_wicket).length || 0
            };
            
            allOversData[inningsId].overs[overNum] = simplifiedOverData;
            console.log(`[BALL-BY-BALL] ✅ Fetched over ${overNum} of ${inningsId} (${simplifiedOverData.balls?.length || 0} balls, ${simplifiedOverData.totalRuns} runs)`);
          } else {
            console.warn(`[BALL-BY-BALL] No data for over ${overNum} of ${inningsId}`);
          }

          // Small delay to avoid rate limiting
          if (oversToFetch.length > 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        } catch (overError: any) {
          console.error(`[BALL-BY-BALL] Failed to fetch over ${overNum}:`, {
            message: overError?.message,
            status: overError?.response?.status
          });
          // Continue with next over even if one fails
        }
      }

      // Enhance live data with ball-by-ball data
      const enhancedLiveData = {
        ...liveData,
        ballByBallData: allOversData
      };

      // Store in Database - with ball-by-ball data embedded
      await this._DB.LiveMatchData.create({
        matchKey,
        simplifiedData: enhancedLiveData,
      } as any);

      console.log(`[BALL-BY-BALL] ✅ Stored ${oversToFetch.length} over(s) for match: ${matchKey}`);
      console.log(`[BALL-BY-BALL] 📊 Total overs stored: ${Object.keys(allOversData[inningsId]?.overs || {}).length} for ${inningsId}`);

      // Return enhanced data so it can be stored in live_updates list
      return enhancedLiveData;
    } catch (error: any) {
      console.error(`[BALL-BY-BALL] Failed to fetch ball-by-ball data for match ${matchKey}:`, {
        message: error?.message,
        status: error?.response?.status
      });
      // Return original data on error
      return liveData;
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

  // Manual endpoint to update match status
  async updateMatchStatus(req: Request, res: Response) {
    const matchKey = req.params.key;
    const { status, winner, endedAt, startedAt } = req.body;

    try {
      if (!matchKey) {
        return res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: "Match key is required",
          data: null,
          errors: ["Match key is required"],
          timestamp: new Date().toISOString(),
        });
      }

      // Validate status if provided
      const validStatuses = ["not_started", "started", "completed", "cancelled"];
      if (status && !validStatuses.includes(status)) {
        return res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
          data: null,
          errors: [`Invalid status: ${status}`],
          timestamp: new Date().toISOString(),
        });
      }

      const updateData: any = {};
      if (status !== undefined) updateData.status = status;
      if (winner !== undefined) updateData.winner = winner;
      if (endedAt !== undefined) updateData.endedAt = endedAt;
      if (startedAt !== undefined) updateData.startedAt = startedAt;

      if (Object.keys(updateData).length === 0) {
        return res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: "No update data provided. Please provide at least one field to update (status, winner, endedAt, startedAt)",
          data: null,
          errors: ["No update data provided"],
          timestamp: new Date().toISOString(),
        });
      }

      const result = await this.matchService.updateMatchStatus(matchKey, updateData);

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        message: "Match status updated successfully",
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

  public async getMatchStats(req: Request, res: Response) {
    try {
      const stats = await this.matchService.getMatchStats();

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        message: "Match statistics fetched successfully",
        data: stats,
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
}
