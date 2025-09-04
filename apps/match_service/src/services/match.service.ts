import { MatchListQuery } from "@/types/subscription.type";
import "tsyringe";
import { autoInjectable } from "tsyringe";
import MatchRepository from "../repositories/match.repository";

@autoInjectable()
export default class MatchService {
  constructor(private readonly repo?: MatchRepository) {}

  public async getAll(query: MatchListQuery) {
    const { count, rows } = await this.repo!.list(query);
    const items = rows.map((m: any) => {
      const plain = m.toJSON();
      return {
        ...plain,
        start_at_iso: plain.start_at
          ? new Date(plain.start_at).toISOString()
          : null,
      };
    });
    return { count, items };
  }

  public async getByMatchKey(match_key: string) {
    const found = await this.repo!.findByKey(match_key);
    if (!found) {
      const err: any = new Error("Match not found");
      err.statusCode = 404;
      throw err;
    }
    const plain = found.toJSON();
    return {
      ...plain,
      start_at_iso: plain.start_at
        ? new Date(plain.start_at).toISOString()
        : null,
    };
  }
}
