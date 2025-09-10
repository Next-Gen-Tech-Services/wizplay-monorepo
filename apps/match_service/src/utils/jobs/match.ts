import { logger } from "@repo/common";
import axios from "axios";
import cron from "node-cron";
import { URLSearchParams } from "url";
import ServerConfigs from "../../configs/server.config";

class MatchCrons {
  private authToken: string | null;
  private roanuzPK: string;
  private roanuzAK: string;

  constructor() {
    this.authToken = null;
    this.roanuzAK = ServerConfigs.ROANUZ_AK;
    this.roanuzPK = ServerConfigs.ROANUZ_PK;
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

      logger.info(
        `[MATCH-CRON] auth response: ${JSON.stringify(response.data, null, 2)}`
      );
      this.authToken = response?.data?.data?.token;
      return response?.data;
    } catch (error: any) {
      logger.error(`[MATCH-CRON] Error in auth api ${error.message}`);
    }
  }

  async scheduleJob() {
    cron.schedule("* * * * *", async () => {
      logger.info("[MATCH-CRON] cron job scheduled");
      const token = await this.generateApiToken();
      logger.info("[MATCH-CRON] cron job executed");
    });
  }
}

export default new MatchCrons();
