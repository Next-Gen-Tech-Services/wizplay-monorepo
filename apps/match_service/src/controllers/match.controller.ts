import { STATUS_CODE } from "@repo/common";
import { Request, Response } from "express";
import "reflect-metadata";
import "tsyringe";
import { autoInjectable, inject } from "tsyringe";
import { Server as SocketIOServer } from "socket.io";
import MatchService from "../services/match.service";
import zlib from "zlib";
import transformMatch from "../utils/transformLiveMatchData";

const lastSeen: Record<string, string | number> = {};

@autoInjectable()
export default class MatchController {
  constructor(private readonly matchService: MatchService, @inject("SocketIO") private readonly io?: SocketIOServer) { }

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
      req.on("end", () => {
        const buffer = Buffer.concat(chunks);

        // gunzip
        zlib.gunzip(buffer, (err, decoded) => {
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

          // broadcast to sockets and SSE clients
          this.broadcast(matchId, "match_update", cleaned);

          // respond to webhook provider quickly
          res.status(200).send({ ok: true });

        });
      });
    } catch (err: any) { }
  }
}
