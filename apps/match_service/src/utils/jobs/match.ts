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

  async getMG101MatchData() {
    try {
      const roanuzToken = await redis.getter("roanuzToken");
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, "0");
      
      const mg101Response = await axios({
        method: "GET",
        url: `https://api.sports.roanuz.com/v5/cricket/${this.roanuzPK}/fixtures/mg/MG101/date/${year}-${month}/page/1/`,
        headers: {
          "Content-Type": "application/json",
          "rs-token": roanuzToken || this.authToken,
        },
      });
      
      logger.info(
        `[MATCH-CRON] MG101 response: ${JSON.stringify(mg101Response.status)}`
      );

      if (mg101Response?.status !== 200) {
        throw new Error(mg101Response?.data?.error);
      }

      // Extract and format MG101 data
      const mg101InputDays = {
        days: mg101Response?.data?.data?.month?.days,
      };
      const extractedMG101Data = extractMatches(mg101InputDays);
      const mg101MatchAndTournament = formatMatchData(extractedMG101Data);
      
      logger.info(`[MATCH-CRON] MG101 matches fetched: ${mg101MatchAndTournament.matches?.length || 0}`);

      return mg101MatchAndTournament;
    } catch (error: any) {
      logger.error(`[MATCH-CRON] Error in MG101 match data api ${error.message}`);
      return { matches: [], tournaments: [] };
    }
  }

  async scheduleJob() {
    cron.schedule("0 0 * * *", async () => {
      logger.info("[MATCH-CRON] cron job scheduled");
      const token = await this.generateApiToken();
      
      // Fetch regular fixtures
      const regularData = await this.getMatchData();
      
      // Fetch MG101 fixtures
      const mg101Data = await this.getMG101MatchData();
      
      // Merge both datasets
      const allMatches = [
        ...(regularData?.matches || []),
        ...(mg101Data?.matches || []),
      ];
      
      const allTournaments = [
        ...(regularData?.tournaments || []),
        ...(mg101Data?.tournaments || []),
      ];

      logger.info(`[MATCH-CRON] Total matches to insert: ${allMatches.length}`);
      logger.info(`[MATCH-CRON] Total tournaments to insert: ${allTournaments.length}`);

      await this.tournamentRepository.createBulkTournaments(allTournaments);
      await this.matchRepository.createBulkMatches(allMatches);
      logger.info("[MATCH-CRON] cron job executed");
    });
  }
}

export default new MatchCrons();
