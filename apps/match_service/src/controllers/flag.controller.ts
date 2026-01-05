import { logger } from "@repo/common";
import { Request, Response } from "express";
import countryFlagsCron from "../utils/jobs/country-flags";
import FlagMappingService from "../utils/flagMapping.service";

/**
 * Manual trigger endpoint for syncing country flags
 * This can be used to force a flag sync without waiting for the cron schedule
 */
export default class FlagController {
  public async syncFlags(req: Request, res: Response) {
    try {
      logger.info("[FLAG-CONTROLLER] Manual flag sync triggered");
      
      // This will run the sync in the background
      countryFlagsCron["syncFlags"]().then(() => {
        logger.info("[FLAG-CONTROLLER] Manual flag sync completed");
      }).catch((error) => {
        logger.error(`[FLAG-CONTROLLER] Manual flag sync failed: ${error.message}`);
      });

      return res.status(200).json({
        success: true,
        message: "Flag sync started in background. Check logs for progress.",
      });
    } catch (error: any) {
      logger.error(`[FLAG-CONTROLLER] Error: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: "Failed to trigger flag sync",
        error: error.message,
      });
    }
  }

  public async getFlagStatus(req: Request, res: Response) {
    try {
      const fs = require("fs");
      const path = require("path");
      const flagsDir = path.join(process.cwd(), "public", "flags");
      
      if (!fs.existsSync(flagsDir)) {
        return res.status(200).json({
          success: true,
          totalFlags: 0,
          message: "Flags directory not yet created",
        });
      }

      const files = fs.readdirSync(flagsDir).filter((f: string) => 
        f.endsWith(".png") || f.endsWith(".jpg") || f.endsWith(".jpeg") || f.endsWith(".svg")
      );
      
      // Get team mapping stats
      const flagService = FlagMappingService.getInstance();
      const stats = flagService.getStats();
      
      return res.status(200).json({
        success: true,
        totalFlags: files.length,
        flags: files,
        mappingStats: stats,
      });
    } catch (error: any) {
      logger.error(`[FLAG-CONTROLLER] Error: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: "Failed to get flag status",
        error: error.message,
      });
    }
  }

  /**
   * Get flag URL for a specific team key
   */
  public async getTeamFlag(req: Request, res: Response) {
    try {
      const { teamKey } = req.params;
      
      if (!teamKey) {
        return res.status(400).json({
          success: false,
          message: "Team key is required",
        });
      }

      const flagService = FlagMappingService.getInstance();
      const flagUrl = flagService.getFlagUrl(teamKey, process.env.ASSET_SERVICE_URL || "");
      
      if (!flagUrl) {
        return res.status(404).json({
          success: false,
          message: `No flag found for team key: ${teamKey}`,
        });
      }

      return res.status(200).json({
        success: true,
        teamKey,
        flagUrl,
        filename: flagService.getFlagFilename(teamKey),
      });
    } catch (error: any) {
      logger.error(`[FLAG-CONTROLLER] Error: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: "Failed to get team flag",
        error: error.message,
      });
    }
  }

  /**
   * Get all available team keys and their flag mappings
   */
  public async getAllTeamMappings(req: Request, res: Response) {
    try {
      const flagService = FlagMappingService.getInstance();
      const teamKeys = flagService.getAllTeamKeys();
      const stats = flagService.getStats();
      
      return res.status(200).json({
        success: true,
        totalMappings: stats.totalMappings,
        teamKeys: teamKeys,
      });
    } catch (error: any) {
      logger.error(`[FLAG-CONTROLLER] Error: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: "Failed to get team mappings",
        error: error.message,
      });
    }
  }
}
