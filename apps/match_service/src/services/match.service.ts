import { BadRequestError } from "@repo/common";
import "tsyringe";
import { autoInjectable } from "tsyringe";
import { IMatchFilters } from "../interfaces/match";
import MatchRepository from "../repositories/match.repository";

@autoInjectable()
export default class MatchService {
  constructor(private readonly matchRepository: MatchRepository) {}

  public async fetchAllMatchesWithFilters(query: IMatchFilters) {
    try {
      const matches = await this.matchRepository.fetchAllMatches(query);

      return matches;
    } catch (error: any) {
      throw new BadRequestError(error.message);
    }
  }
}
