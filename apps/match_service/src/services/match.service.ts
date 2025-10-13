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
      if (!matchId) {
        throw new BadRequestError("Missing match id");
      }

      var options = {
        method: "POST",
        url: `https://api.sports.roanuz.com/v5/cricket/${ServerConfigs.ROANUZ_PK}/match/${matchId}/updates-subscribe/`,
        headers: {
          "rs-token": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          method: "web_hook",
        }),
      };
      logger.info(`${JSON.stringify(options, null, 2)}`);
      const response = await axios(options);
      logger.info(`API RESPONSE. =======> ${response}`);
      return response;
    } catch (error: any) {
      throw new BadRequestError(error?.message || "Failed to update match");
    }
  }

  public async unsubscribeMatch(matchId: string, token: string) {
    try {
      if (!matchId) {
        throw new BadRequestError("Missing match id");
      }

      var options = {
        method: "POST",
        url: `https://api.sports.roanuz.com/v5/cricket/${ServerConfigs.ROANUZ_PK}/match/${matchId}/updates-unsubscribe/`,
        headers: {
          "rs-token": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          method: "web_hook",
        }),
      };
      logger.info(`${JSON.stringify(options, null, 2)}`);
      const response = await axios(options);
      logger.info(`API RESPONSE. =======> ${response}`);
      return response;
    } catch (error: any) {
      throw new BadRequestError(error?.message || "Failed to update match");
    }
  }
}
