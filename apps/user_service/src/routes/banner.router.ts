import { Router, Request, Response } from "express";
import BannerController from "../controllers/banner.controller";
import upload from "../middlewares/multer.middleware";

const router = Router();
const bannerController = new BannerController();

// Upload banner
router.post(
  "/banners/upload",
  upload.single("banner"),
  async (req: Request, res: Response) => {
    return bannerController.uploadBanner(req as any, res);
  }
);

// Get all banners
router.get("/banners", async (req: Request, res: Response) => {
  return bannerController.getBanners(req, res);
});

// Delete banner
router.delete("/banners/:filename", async (req: Request, res: Response) => {
  return bannerController.deleteBanner(req, res);
});

export default router;
