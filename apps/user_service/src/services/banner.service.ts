import * as fs from "fs";
import * as path from "path";
import { logger } from "@repo/common";
import ServerConfigs from "../configs/server.config";

class BannerService {
  private bannerDir = path.join(__dirname, "../../public/banners");

  constructor() {
    // Ensure banners directory exists
    if (!fs.existsSync(this.bannerDir)) {
      fs.mkdirSync(this.bannerDir, { recursive: true });
      logger.info(`Created banners directory: ${this.bannerDir}`);
    }
  }

  public async getAllBanners(): Promise<any[]> {
    try {
      if (!fs.existsSync(this.bannerDir)) {
        return [];
      }

      const files = fs.readdirSync(this.bannerDir);
      const asset_url = ServerConfigs.ASSET_SERVICE_URL || "http://localhost:8000";
      const banners = files.map((filename) => ({
        filename,
        url: `${asset_url}api/v1/banners/${filename}`,
        uploadedAt: fs.statSync(path.join(this.bannerDir, filename)).mtime,
      }));

      return banners;
    } catch (err: any) {
      logger.error(`Failed to get banners: ${err?.message}`);
      return [];
    }
  }

  public async deleteBanner(filename: string): Promise<boolean> {
    try {
      const filePath = path.join(this.bannerDir, filename);

      // Security check: ensure the file is within the banners directory
      if (!filePath.startsWith(this.bannerDir)) {
        logger.warn(`Attempted to delete file outside banners directory: ${filename}`);
        return false;
      }

      if (!fs.existsSync(filePath)) {
        logger.warn(`Banner file not found: ${filename}`);
        return false;
      }

      fs.unlinkSync(filePath);
      logger.info(`Deleted banner: ${filename}`);
      return true;
    } catch (err: any) {
      logger.error(`Failed to delete banner ${filename}: ${err?.message}`);
      return false;
    }
  }
}

export default BannerService;
