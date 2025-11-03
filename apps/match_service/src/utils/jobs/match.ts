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

  private async fetchMatchesForNext48Hours() {
    try {
      const roanuzToken = await redis.getter("roanuzToken");
      const start = new Date();
      const end = new Date(start.getTime() + 48 * 60 * 60 * 1000);
      const params = {
        date_from: start.toISOString(),
        date_to: end.toISOString(),
      };
      const matchResponse = await axios({
        method: "GET",
        url: `https://api.sports.roanuz.com/v5/cricket/${this.roanuzPK}/fixtures/`,
        headers: {
          "Content-Type": "application/json",
          "rs-token": roanuzToken || this.authToken,
        },
        params,
      });
      if (matchResponse?.status !== 200)
        throw new Error(matchResponse?.data?.error);
      const inputDays = { days: matchResponse?.data?.data?.month?.days };
      const extractedData = extractMatches(inputDays);
      const matchAndTournament = formatMatchData(extractedData);
      const currentDate = new Date().toLocaleDateString();
      await redis.setter(currentDate, JSON.stringify(matchAndTournament));
      return matchAndTournament;
    } catch (error: any) {
      logger.error(`[MATCH-CRON] Error in match data api ${error.message}`);
      return null;
    }
  }

  async scheduleJob() {
    // Run every 1 minute: "* * * * *"
    cron.schedule("* * * * *", async () => {
      try {
        logger.info("[MATCH-CRON] Cron job started - Running every 1 minute");
        
        const token = await this.generateApiToken();
        if (!token) {
          logger.error("[MATCH-CRON] Failed to generate API token");
          return;
        }

        const matchData = await this.getMatchData();

        if (!matchData) {
          logger.error("[MATCH-CRON] No match data received from API");
          return;
        }

        const { matches, tournaments } = matchData;
        logger.info(
          `[MATCH-CRON] Received ${tournaments?.length || 0} tournaments and ${matches?.length || 0} matches from API`
        );

        if (tournaments?.length > 0) {
          await this.tournamentRepository.createBulkTournaments(tournaments);
        }
        
        if (matches?.length > 0) {
          await this.matchRepository.createBulkMatches(matches);
        }

        logger.info("[MATCH-CRON] Cron job executed successfully");
      } catch (error: any) {
        logger.error(`[MATCH-CRON] Error in cron job execution: ${error.message}`);
      }
    });
    
    logger.info("[MATCH-CRON] Job scheduled to run every 1 minute");
  }
}

export default new MatchCrons();
