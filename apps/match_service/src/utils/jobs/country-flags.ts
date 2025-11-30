import { logger } from "@repo/common";
import axios from "axios";
import cron from "node-cron";
import * as fs from "fs";
import * as path from "path";
import redis from "../../configs/redis.config";
import ServerConfigs from "../../configs/server.config";
import { generateApiToken } from "../utils";

class CountryFlagsCron {
  private roanuzPK: string;
  private flagsDirectory: string;

  constructor() {
    this.roanuzPK = ServerConfigs.ROANUZ_PK;

    this.flagsDirectory = path.join(process.cwd(), "public", "flags");

    // Create flags directory if it doesn't exist
    if (!fs.existsSync(this.flagsDirectory)) {
      fs.mkdirSync(this.flagsDirectory, { recursive: true });
      logger.info(`[FLAGS-CRON] Created flags directory: ${this.flagsDirectory}`);
    }
  }

  private async getCountryList(): Promise<any[]> {
    try {
      const roanuzToken = await redis.getter("roanuzToken");

      if (!roanuzToken) {
        logger.warn("[FLAGS-CRON] No Roanuz token available, generating new one...");
        await generateApiToken();
      }

      const token = await redis.getter("roanuzToken");

      const response = await axios({
        method: "GET",
        url: `https://api.sports.roanuz.com/v5/cricket/${this.roanuzPK}/country/list/`,
        headers: {
          "Content-Type": "application/json",
          "rs-token": token,
        },
      });

      if (response?.status !== 200) {
        throw new Error(response?.data?.error || "Failed to fetch country list");
      }

      logger.info(`[FLAGS-CRON] Fetched ${response.data?.data?.countries?.length || 0} countries`);
      return response.data?.data?.countries || [];
    } catch (error: any) {
      logger.error(`[FLAGS-CRON] Error fetching country list: ${error.message}`);
      throw error;
    }
  }

  private async downloadFlag(countryCode: string): Promise<boolean> {
    try {
      const roanuzToken = await redis.getter("roanuzToken");

      const response = await axios({
        method: "GET",
        url: `https://api.sports.roanuz.com/v5/cricket/${this.roanuzPK}/country/${countryCode}/flags/`,
        headers: {
          "rs-token": roanuzToken,
        },
        responseType: "arraybuffer", // Important for binary data
      });

      if (response?.status === 200) {
        const flagPath = path.join(this.flagsDirectory, `${countryCode.toLowerCase()}.svg`);
        fs.writeFileSync(flagPath, response.data);
        logger.debug(`[FLAGS-CRON] Downloaded flag for ${countryCode}`);
        return true;
      }

      return false;
    } catch (error: any) {
      logger.error(`[FLAGS-CRON] Error downloading flag for ${countryCode}: ${error.message}`);
      return false;
    }
  }

  private async syncFlags(): Promise<void> {
    try {
      logger.info("[FLAGS-CRON] Starting country flags sync...");

      const countries = await this.getCountryList();

      if (!countries || countries.length === 0) {
        logger.warn("[FLAGS-CRON] No countries found to sync");
        return;
      }

      let successCount = 0;
      let failCount = 0;

      // Download flags with rate limiting (avoid overwhelming the API)
      for (let i = 0; i < countries.length; i++) {
        const country = countries[i];
        const countryCode = country.code || country.short_code;

        if (!countryCode) {
          logger.warn(`[FLAGS-CRON] Country missing code: ${JSON.stringify(country)}`);
          continue;
        }

        const success = await this.downloadFlag(countryCode);

        if (success) {
          successCount++;
        } else {
          failCount++;
        }

        // Add small delay to avoid rate limiting (100ms between requests)
        if (i < countries.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      logger.info(
        `[FLAGS-CRON] Flags sync completed. Success: ${successCount}, Failed: ${failCount}, Total: ${countries.length}`
      );

      // Cache the country list in Redis for quick lookup
      await redis.setter("country_list", JSON.stringify(countries));
      logger.info("[FLAGS-CRON] Cached country list in Redis");

    } catch (error: any) {
      logger.error(`[FLAGS-CRON] Error in syncFlags: ${error.message}`);
    }
  }

  public async scheduleJob(): Promise<void> {
    // Run once on startup - generate API token using shared utility
    logger.info("[FLAGS-CRON] Running initial flags sync on startup...");
    try {
      await generateApiToken();
      logger.info("[FLAGS-CRON] API token generated successfully");
    } catch (err: any) {
      logger.error(`[FLAGS-CRON] Initial token generation failed: ${err?.message || err}`);
    }

    // Schedule to run daily at 2 AM (when traffic is low)
    cron.schedule("0 2 * * *", async () => {
      logger.info("[FLAGS-CRON] Running scheduled flags sync...");
      await generateApiToken();
      await this.syncFlags();
    });

    logger.info("[FLAGS-CRON] Job scheduled to run daily at 2 AM");
  }
}

export default new CountryFlagsCron();
