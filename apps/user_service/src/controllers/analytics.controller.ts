import { logger, STATUS_CODE } from "@repo/common";
import { Request, Response } from "express";
import { autoInjectable } from "tsyringe";
import AnalyticsService from "../services/analytics.service";

@autoInjectable()
export default class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * Get comprehensive dashboard analytics
   * @route GET /api/v1/admin/analytics/dashboard
   * @access Admin only
   */
  public async getDashboardAnalytics(req: Request, res: Response) {
    try {
      logger.info(
        `[AnalyticsController] Fetching dashboard analytics for admin`
      );

      const analytics = await this.analyticsService.getDashboardAnalytics();

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        data: analytics,
        message: "Dashboard analytics fetched successfully",
        errors: null,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      logger.error(
        `[AnalyticsController] Error fetching dashboard analytics: ${err.message}`
      );

      return res.status(STATUS_CODE.INTERNAL_SERVER ?? 500).json({
        success: false,
        message: "Failed to fetch dashboard analytics",
        data: null,
        errors: err.message ?? null,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get user growth analytics
   * @route GET /api/v1/admin/analytics/users/growth
   * @access Admin only
   */
  public async getUserGrowthAnalytics(req: Request, res: Response) {
    try {
      const { period = "week" } = req.query; // day, week, month, year

      logger.info(
        `[AnalyticsController] Fetching user growth analytics for period: ${period}`
      );

      // This can be expanded to show growth trends over time
      const analytics = await this.analyticsService.getDashboardAnalytics();

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        data: {
          users: analytics.users,
          period,
        },
        message: "User growth analytics fetched successfully",
        errors: null,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      logger.error(
        `[AnalyticsController] Error fetching user growth: ${err.message}`
      );

      return res.status(STATUS_CODE.INTERNAL_SERVER ?? 500).json({
        success: false,
        message: "Failed to fetch user growth analytics",
        data: null,
        errors: err.message ?? null,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get revenue analytics
   * @route GET /api/v1/admin/analytics/revenue
   * @access Admin only
   */
  public async getRevenueAnalytics(req: Request, res: Response) {
    try {
      logger.info(`[AnalyticsController] Fetching revenue analytics`);

      const analytics = await this.analyticsService.getDashboardAnalytics();

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        data: {
          revenue: analytics.revenue,
          wallets: analytics.wallets,
          transactions: analytics.transactions,
        },
        message: "Revenue analytics fetched successfully",
        errors: null,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      logger.error(
        `[AnalyticsController] Error fetching revenue analytics: ${err.message}`
      );

      return res.status(STATUS_CODE.INTERNAL_SERVER ?? 500).json({
        success: false,
        message: "Failed to fetch revenue analytics",
        data: null,
        errors: err.message ?? null,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get contest analytics
   * @route GET /api/v1/admin/analytics/contests
   * @access Admin only
   */
  public async getContestAnalytics(req: Request, res: Response) {
    try {
      logger.info(`[AnalyticsController] Fetching contest analytics`);

      const analytics = await this.analyticsService.getDashboardAnalytics();

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        data: {
          contests: analytics.contests,
          matches: analytics.matches,
        },
        message: "Contest analytics fetched successfully",
        errors: null,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      logger.error(
        `[AnalyticsController] Error fetching contest analytics: ${err.message}`
      );

      return res.status(STATUS_CODE.INTERNAL_SERVER ?? 500).json({
        success: false,
        message: "Failed to fetch contest analytics",
        data: null,
        errors: err.message ?? null,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
