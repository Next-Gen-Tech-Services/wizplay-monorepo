import { Request, Response, Router } from "express";
import "reflect-metadata";
import { container } from "tsyringe";
import AnalyticsController from "../controllers/analytics.controller";
import { requireAdminAuth } from "../middlewares/auth.middleware";

const router = Router();
const analyticsController: AnalyticsController =
  container.resolve(AnalyticsController);

/**
 * Admin Analytics Routes
 * All routes require admin authentication
 */

// Get comprehensive dashboard analytics
router.get(
  "/admin/analytics/dashboard",
  requireAdminAuth,
  async (req: Request, res: Response) => {
    const result = await analyticsController.getDashboardAnalytics(req, res);
    return result;
  }
);

// Get user growth analytics
router.get(
  "/admin/analytics/users/growth",
  requireAdminAuth,
  async (req: Request, res: Response) => {
    const result = await analyticsController.getUserGrowthAnalytics(req, res);
    return result;
  }
);

// Get revenue analytics
router.get(
  "/admin/analytics/revenue",
  requireAdminAuth,
  async (req: Request, res: Response) => {
    const result = await analyticsController.getRevenueAnalytics(req, res);
    return result;
  }
);

// Get contest analytics
router.get(
  "/admin/analytics/contests",
  requireAdminAuth,
  async (req: Request, res: Response) => {
    const result = await analyticsController.getContestAnalytics(req, res);
    return result;
  }
);

export default router;
