import { BadRequestError } from "@repo/common";
import "tsyringe";
import { autoInjectable } from "tsyringe";
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
}
