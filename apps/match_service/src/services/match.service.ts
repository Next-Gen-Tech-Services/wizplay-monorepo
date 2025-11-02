import { BadRequestError } from "@repo/common";
import axios from "axios";
import "tsyringe";
import { autoInjectable } from "tsyringe";
import ServerConfigs from "../configs/server.config";
import { IMatchFilters } from "../interfaces/match";
import MatchRepository from "../repositories/match.repository";

@autoInjectable()
export default class MatchService {
  constructor(private readonly matchRepository: MatchRepository) {}

  public async fetchAllMatchesWithFilters(query: IMatchFilters, userId: any) {
    try {
      const matches = await this.matchRepository.fetchAllMatches(query, userId);

      return matches;
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
}
