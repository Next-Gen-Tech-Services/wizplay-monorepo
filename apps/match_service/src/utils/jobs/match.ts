import { logger } from "@repo/common";
import axios from "axios";
import cron from "node-cron";
import { URLSearchParams } from "url";
import redis from "../../configs/redis.config";
import ServerConfigs from "../../configs/server.config";
import MatchRepository from "../../repositories/match.repository";
import TournamentRepository from "../../repositories/tournament.repository";
import { extractMatches, formatMatchData } from "../formatMatchData";

class MatchCrons {
  private authToken: string | null;
  private roanuzPK: string;
  private roanuzAK: string;
  private matchRepository: MatchRepository;
  private tournamentRepository: TournamentRepository;

  constructor() {
    this.authToken = null;
    this.roanuzAK = ServerConfigs.ROANUZ_AK;
    this.roanuzPK = ServerConfigs.ROANUZ_PK;
    this.matchRepository = new MatchRepository();
    this.tournamentRepository = new TournamentRepository();
  }

  async generateApiToken() {
    try {
      const response = await axios({
        method: "POST",
        url: `https://api.sports.roanuz.com/v5/core/${this.roanuzPK}/auth/`,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        data: new URLSearchParams({ api_key: this.roanuzAK }).toString(),
      });

      if (response?.status !== 200) {
        throw new Error(response?.data?.error);
      }

      logger.info(
        `[MATCH-CRON] auth response: ${JSON.stringify(response.status)}`
      );
      this.authToken = response?.data?.data?.token;
      const result = await redis.setter("roanuzToken", this.authToken!);

      return result;
    } catch (error: any) {
      logger.error(`[MATCH-CRON] Error in auth api ${error.message}`);
    }
  }

  async getMatchData() {
    try {
      const roanuzToken = await redis.getter("roanuzToken");
      const matchResponse = await axios({
        method: "GET",
        url: `https://api.sports.roanuz.com/v5/cricket/${this.roanuzPK}/fixtures/`,
        headers: {
          "Content-Type": "application/json",
          "rs-token": roanuzToken || this.authToken,
        },
      });
      logger.info(
        `[MATCH-CRON] match response: ${JSON.stringify(matchResponse.status)}`
      );

      if (matchResponse?.status !== 200) {
        throw new Error(matchResponse?.data?.error);
      }
      const inputDays = {
        days: matchResponse?.data?.data?.month?.days,
      };
      const extractedData = extractMatches(inputDays);
      const matchAndTournament = formatMatchData(extractedData);
      const currentDate = new Date().toLocaleDateString();
      const cacheData = await redis.setter(
        currentDate,
        JSON.stringify(matchAndTournament)
      );

      return matchAndTournament;
    } catch (error: any) {
      logger.error(`[MATCH-CRON] Error in match data api ${error.message}`);
    }
  }

  async scheduleJob() {
    cron.schedule("0 0 * * *", async () => {
      logger.info("[MATCH-CRON] cron job scheduled");
      const token = await this.generateApiToken();
      const { matches, tournaments } = await this.getMatchData();

      await this.tournamentRepository.createBulkTournaments(tournaments);
      await this.matchRepository.createBulkMatches(matches);
      logger.info("[MATCH-CRON] cron job executed");
    });
  }
}

export default new MatchCrons();
