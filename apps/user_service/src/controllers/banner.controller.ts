import { Request, Response } from "express";
import { logger } from "@repo/common";
import BannerService from "../services/banner.service";
import { STATUS_CODE } from "@repo/common";

class BannerController {
  private bannerService = new BannerService();

  public async uploadBanner(req: Request, res: Response): Promise<any> {
    try {
      if (!req.file) {
        return res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: "No file uploaded",
          data: null,
        });
      }

      const { filename, path, mimetype, size } = req.file;
      const bannerUrl = `/api/v1/banners/${filename}`;

      logger.info(`Banner uploaded: ${filename}, Size: ${size} bytes`);

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        message: "Banner uploaded successfully",
        data: {
          filename,
          url: bannerUrl,
          size,
          mimetype,
        },
      });
    } catch (err: any) {
      logger.error(`Banner upload error: ${err?.message ?? err}`);
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        message: "Failed to upload banner",
        data: null,
      });
    }
  }

  public async getBanners(req: Request, res: Response): Promise<any> {
    try {
      const banners = await this.bannerService.getAllBanners();

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        message: "Banners retrieved successfully",
        data: banners,
      });
    } catch (err: any) {
      logger.error(`Get banners error: ${err?.message ?? err}`);
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        message: "Failed to retrieve banners",
        data: null,
      });
    }
  }

  public async deleteBanner(req: Request, res: Response): Promise<any> {
    try {
      const { filename } = req.params;

      if (!filename) {
        return res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: "Filename is required",
          data: null,
        });
      }

      const result = await this.bannerService.deleteBanner(filename);

      if (!result) {
        return res.status(STATUS_CODE.NOT_FOUND).json({
          success: false,
          message: "Banner not found",
          data: null,
        });
      }

      logger.info(`Banner deleted: ${filename}`);

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        message: "Banner deleted successfully",
        data: { filename },
      });
    } catch (err: any) {
      logger.error(`Banner delete error: ${err?.message ?? err}`);
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        message: "Failed to delete banner",
        data: null,
      });
    }
  }
}

export default BannerController;
