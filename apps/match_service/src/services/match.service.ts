import { BadRequestError, logger } from "@repo/common";
import axios from "axios";
import "tsyringe";
import { autoInjectable } from "tsyringe";
import ServerConfigs from "../configs/server.config";
import { IMatchFilters } from "../interfaces/match";
import MatchRepository from "../repositories/match.repository";
import { generateApiToken } from "../utils/utils";

@autoInjectable()
export default class MatchService {
  constructor(private readonly matchRepository: MatchRepository) { }

  public async fetchAllMatchesWithFilters(query: IMatchFilters, userId: any) {
    try {
      const matches = await this.matchRepository.fetchAllMatches(query, userId);

      return matches;
    } catch (error: any) {
      throw new BadRequestError(error.message);
    }
  }

  public async fetchMatchById(matchId: string) {
    try {
      const match = await this.matchRepository.getMatchById(matchId);
      
      return match;
    } catch (error: any) {
      throw new BadRequestError(error.message);
    }
  }
  public async updateMatch(matchId: string, showOnFrontend: boolean) {
    try {
      if (!matchId) {
        throw new BadRequestError("Missing match id");
      }

      const updated = await this.matchRepository.updateMatch(
        matchId,
        showOnFrontend
      );

      return updated;
    } catch (error: any) {
      throw new BadRequestError(error?.message || "Failed to update match");
    }
  }

  public async subscribeMatch(matchId: string, token: string) {
    try {
      console.log(`${matchId}: ${token}`);
      if (!matchId) {
        throw new BadRequestError("Missing match id");
      }

      const options = {
        method: "POST",
        url: `https://api.sports.roanuz.com/v5/cricket/${ServerConfigs.ROANUZ_PK}/match/${matchId}/subscribe/`,
        headers: {
          "rs-token": token,
          "Content-Type": "application/json",
        },
        data: {
          method: "web_hook",
        },
      };

      console.log(`${JSON.stringify(options, null, 2)}`);
      const response = await axios(options);
      return response.data;
    } catch (error: any) {
      // Check if already subscribed error (P-400-4)
      const errorCode = error.response?.data?.error?.code;
      if (errorCode === "P-400-4") {
        // Already subscribed - treat as success
        logger.info(`Match ${matchId} is already subscribed - skipping`);
        return {
          data: null,
          message: "Already subscribed",
          already_subscribed: true,
        };
      }

      console.error(
        "Subscribe match error:",
        error.response?.data || error.message
      );
      throw new BadRequestError(
        JSON.stringify(error.response?.data?.error) ||
        error?.message ||
        "Failed to subscribe to match updates"
      );
    }
  }

  public async unsubscribeMatch(matchId: string, token: string) {
    try {
      if (!matchId) {
        throw new BadRequestError("Missing match id");
      }

      const options = {
        method: "POST",
        url: `https://api.sports.roanuz.com/v5/cricket/${ServerConfigs.ROANUZ_PK}/match/${matchId}/unsubscribe/`,
        headers: {
          "rs-token": token,
          "Content-Type": "application/json",
        },
        data: {
          method: "web_hook",
        },
      };

      console.log(`Unsubscribe options: ${JSON.stringify(options, null, 2)}`);
      const response = await axios(options);
      console.log(`API RESPONSE: ${JSON.stringify(response.data, null, 2)}`);
      return response.data;
    } catch (error: any) {
      // Check if already unsubscribed or not subscribed error
      const errorCode = error.response?.data?.error?.code;
      if (errorCode === "P-400-4" || errorCode === "P-404-1") {
        // Not subscribed or already unsubscribed - treat as success
        logger.info(`Match ${matchId} is not subscribed or already unsubscribed - skipping`);
        return {
          data: null,
          message: "Not subscribed or already unsubscribed",
          already_unsubscribed: true,
        };
      }

      console.error(
        "Unsubscribe match error:",
        error.response?.data || error.message
      );
      throw new BadRequestError(
        error.response?.data?.message ||
        error?.message ||
        "Failed to unsubscribe from match updates"
      );
    }
  }

  public async getMatchTeamData(matchId: string) {
    try {
      if (!matchId) {
        throw new BadRequestError("Missing match id");
      }

      const match = await this.matchRepository.getMatchById(matchId);
      if (!match) {
        throw new BadRequestError("Invalid match id");
      }

      // Get token from Redis
      const roanuzToken = await generateApiToken();
      if (!roanuzToken) {
        throw new BadRequestError("Roanuz token not available");
      }
      logger.info(`[MATCH-SERVICE] Roanuz Token: ${match.key}`);

      const options = {
        method: "GET",
        url: `https://api.sports.roanuz.com/v5/cricket/${ServerConfigs.ROANUZ_PK}/match/${match.key}/`,
        headers: {
          "rs-token": roanuzToken,
          "Content-Type": "application/json",
        },
      };

      console.log(`Fetching match team data for: ${matchId}`);
      const response = await axios(options);

      // Extract team data from the response
      const matchData = response.data?.data;

      if (!matchData) {
        throw new BadRequestError("No match data found");
      }

      // Check if we should filter by playing XI
      const showOnlyPlayingXI = matchData.data_review?.playing_xi === true;
      
      // Get player keys from squad
      const squadAKeys = matchData.squad?.a?.playing_xi?.length > 0 
        ? matchData.squad.a.playing_xi 
        : matchData.squad?.a?.player_keys || [];
      
      const squadBKeys = matchData.squad?.b?.playing_xi?.length > 0 
        ? matchData.squad.b.playing_xi 
        : matchData.squad?.b?.player_keys || [];

      // Build team A players
      const teamAPlayers = squadAKeys.map((playerKey: string) => {
        return matchData.players[playerKey]?.player || null;
      }).filter((p: any) => p !== null);

      // Build team B players
      const teamBPlayers = squadBKeys.map((playerKey: string) => {
        return matchData.players[playerKey]?.player || null;
      }).filter((p: any) => p !== null);

      // Return simplified team data
      return {
        teamA: {
          ...matchData.teams.a,
          players: teamAPlayers,
          captain: matchData.squad?.a?.captain || null,
          keeper: matchData.squad?.a?.keeper || null,
        },
        teamB: {
          ...matchData.teams.b,
          players: teamBPlayers,
          captain: matchData.squad?.b?.captain || null,
          keeper: matchData.squad?.b?.keeper || null,
        },
      };
    } catch (error: any) {
      console.error(
        "Get match team data error:",
        error.response?.data || error.message
      );
      throw new BadRequestError(
        error.response?.data?.message ||
        error?.message ||
        "Failed to fetch match team data"
      );
    }
  }

  public async updateMatchStatus(
    matchKey: string,
    data: {
      status?: string;
      winner?: string | null;
      endedAt?: number | null;
      startedAt?: number;
    }
  ) {
    try {
      if (!matchKey) {
        throw new BadRequestError("Missing match key");
      }

      const updatedMatch = await this.matchRepository.updateMatchStatus(
        matchKey,
        data
      );

      return updatedMatch;
    } catch (error: any) {
      throw new BadRequestError(
        error?.message || "Failed to update match status"
      );
    }
  }

  /**
   * Fetch match info from Roanuz API and update match status in database
   * This is used to poll match status for subscribed matches
   */
  public async fetchAndUpdateMatchStatus(matchKey: string, token: string) {
    try {
      if (!matchKey || !token) {
        throw new BadRequestError("Missing match key or token");
      }

      // Fetch match data from Roanuz API
      const options = {
        method: "GET",
        url: `https://api.sports.roanuz.com/v5/cricket/${ServerConfigs.ROANUZ_PK}/match/${matchKey}/`,
        headers: {
          "rs-token": token,
          "Content-Type": "application/json",
        },
      };

      logger.info(`[MATCH-SERVICE] Fetching match status for: ${matchKey}`);
      const response = await axios(options);
      const matchData = response.data?.data;

      if (!matchData) {
        throw new BadRequestError("No match data found from API");
      }

      // Extract status information
      const status = matchData.status; // e.g., "started", "completed", "not_started"
      const playStatus = matchData.play_status; // e.g., "live", "result"
      
      const updateData: any = {};

      // Map API status to database status
      if (status === "started" || playStatus === "live") {
        updateData.status = "started";
        if (matchData.start_at) {
          updateData.startedAt = matchData.start_at;
        }
      } else if (status === "completed" || playStatus === "result") {
        updateData.status = "completed";
        
        // Set endedAt if not already set
        if (matchData.completed_date_approximate) {
          updateData.endedAt = matchData.completed_date_approximate;
        } else if (matchData.estimated_end_date) {
          updateData.endedAt = matchData.estimated_end_date;
        }

        // Extract winner
        if (matchData.winner) {
          updateData.winner = matchData.winner;
        } else if (matchData.play?.result?.msg) {
          // Try to parse winner from result message
          const resultMsg = matchData.play.result.msg;
          const winnerMatch = resultMsg.match(/^(\w+)\s+won/i);
          if (winnerMatch) {
            updateData.winner = winnerMatch[1];
          }
        }
      } else if (status === "not_started") {
        updateData.status = "not_started";
      }

      // Only update if there's something to update
      if (Object.keys(updateData).length > 0) {
        await this.matchRepository.updateMatchStatus(matchKey, updateData);
        logger.info(
          `[MATCH-SERVICE] Updated match ${matchKey} status: ${JSON.stringify(updateData)}`
        );
        return { updated: true, ...updateData };
      }

      return { updated: false, message: "No status change detected" };
    } catch (error: any) {
      logger.error(
        `[MATCH-SERVICE] Error fetching/updating match status for ${matchKey}:`,
        error.response?.data || error.message
      );
      throw new BadRequestError(
        error.response?.data?.message ||
        error?.message ||
        "Failed to fetch and update match status"
      );
    }
  }
}
