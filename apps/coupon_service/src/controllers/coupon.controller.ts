// src/controllers/coupon.controller.ts
import { STATUS_CODE } from "@repo/common";
import { Request, Response } from "express";
import "tsyringe";
import { autoInjectable } from "tsyringe";
import CouponService from "../services/coupon.service";

@autoInjectable()
export default class CouponController {
  constructor(private readonly couponService: CouponService) {}

  /** Create a coupon */
  public async create(req: Request, res: Response) {
    const result = await this.couponService!.createCoupon(req.body);

    return res.status(STATUS_CODE.SUCCESS).json({
      success: true,
      data: result.data,
      message: "Coupon created successfully",
      errors: null,
      timestamp: new Date().toISOString(),
    });
  }

  /** List coupons with filters */
  public async list(req: Request, res: Response) {
    const { search, status, platform, limit, offset } = req.query;
    const result = await this.couponService!.listCoupons({
      search: search as string,
      status: status as string,
      platform: platform as string,
      limit: limit ? Number(limit) : 10,
      offset: offset ? Number(offset) : 0,
    });

    return res.status(STATUS_CODE.SUCCESS).json({
      success: true,
      data: result.items,
      message: "Coupons fetched successfully",
      errors: null,
      timestamp: new Date().toISOString(),
      pagination: {
        total: result.total,
        limit: limit ?? 10,
        offset: offset ?? 0,
      },
    });
  }

  /** Get coupon by ID */
  public async getOne(req: Request, res: Response) {
    const result = await this.couponService!.getCouponById(req.params.id);
    if (!result) {
      return res.status(STATUS_CODE.NOT_FOUND).json({
        success: false,
        data: null,
        message: "Coupon not found",
        errors: null,
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(STATUS_CODE.SUCCESS).json({
      success: true,
      data: result,
      message: "Coupon fetched successfully",
      errors: null,
      timestamp: new Date().toISOString(),
    });
  }

  /** Update coupon */
  public async update(req: Request, res: Response) {
    const result = await this.couponService!.updateCoupon(
      req.params.id,
      req.body
    );
    return res.status(STATUS_CODE.SUCCESS).json({
      success: true,
      data: result,
      message: "Coupon updated successfully",
      errors: null,
      timestamp: new Date().toISOString(),
    });
  }

  /** Delete coupon */
  public async remove(req: Request, res: Response) {
    await this.couponService!.deleteCoupon(req.params.id);
    return res.status(STATUS_CODE.SUCCESS).json({
      success: true,
      data: null,
      message: "Coupon deleted successfully",
      errors: null,
      timestamp: new Date().toISOString(),
    });
  }

  /** Toggle active/inactive */
  public async toggleActive(req: Request, res: Response) {
    const result = await this.couponService!.toggleCouponActive(req.params.id);
    return res.status(STATUS_CODE.SUCCESS).json({
      success: true,
      data: result,
      message: "Coupon status toggled",
      errors: null,
      timestamp: new Date().toISOString(),
    });
  }

  /** Assign Coupons */
  public async assignCoupons(req: Request, res: Response) {
    const result = await this.couponService.assignCoupons(req.body);
    return res.status(STATUS_CODE.SUCCESS).json({
      success: true,
      data: result,
      message: "Coupons Assigned",
      errors: null,
      timestamp: new Date().toISOString(),
    });
  }

  /** Redeem a coupon for a user (one-time use) */
  public async redeemCoupon(req: Request, res: Response) {
    const { userId, couponId } = req.body;

    if (!userId || !couponId) {
      return res.status(STATUS_CODE.BAD_REQUEST).json({
        success: false,
        data: null,
        message: "userId and couponId are required",
        errors: null,
        timestamp: new Date().toISOString(),
      });
    }

    try {
      const result = await this.couponService!.redeemCoupon(userId, couponId);

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        data: result,
        message: "Coupon redeemed successfully",
        errors: null,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      const statusCode = err.message.includes("not found") 
        ? STATUS_CODE.NOT_FOUND 
        : err.message.includes("already redeemed") || err.message.includes("Insufficient")
        ? STATUS_CODE.BAD_REQUEST
        : STATUS_CODE.INTERNAL_SERVER;

      return res.status(statusCode).json({
        success: false,
        data: null,
        message: err.message || "Failed to redeem coupon",
        errors: null,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /** Get available coupons (not yet redeemed) */
  public async getAvailableCoupons(req: Request, res: Response) {
    const { limit, offset } = req.query;

    const result = await this.couponService!.getAvailableCoupons({
      limit: limit ? Number(limit) : 10,
      offset: offset ? Number(offset) : 0,
    });

    return res.status(STATUS_CODE.SUCCESS).json({
      success: true,
      data: result.items,
      message: "Available coupons fetched successfully",
      errors: null,
      timestamp: new Date().toISOString(),
      pagination: {
        total: result.total,
        limit: limit ?? 10,
        offset: offset ?? 0,
      },
    });
  }

  /** Get user's redeemed coupons */
  public async getUserRedeemedCoupons(req: Request, res: Response) {
    const { userId } = req.params;

    if (!userId) {
      return res.status(STATUS_CODE.BAD_REQUEST).json({
        success: false,
        data: null,
        message: "userId is required",
        errors: null,
        timestamp: new Date().toISOString(),
      });
    }

    try {
      const result = await this.couponService!.getUserRedeemedCoupons(userId);

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        data: result,
        message: "User redeemed coupons fetched successfully",
        errors: null,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        data: null,
        message: err.message || "Failed to fetch user redeemed coupons",
        errors: null,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /** Get coupon statistics for analytics dashboard */
  public async getCouponStats(req: Request, res: Response) {
    try {
      const result = await this.couponService!.getCouponStats();

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        data: result,
        message: "Coupon statistics fetched successfully",
        errors: null,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      logger.error(`[CouponController] getCouponStats error: ${err.message}`);
      
      // Determine appropriate status code based on error type
      let statusCode = STATUS_CODE.INTERNAL_SERVER;
      let errorMessage = "Failed to fetch coupon statistics";
      
      if (err.message && err.message.includes('Database connection error')) {
        statusCode = STATUS_CODE.INTERNAL_SERVER || 503;
        errorMessage = "Database service unavailable";
      } else if (err.message && err.message.includes('tables not found')) {
        statusCode = STATUS_CODE.BAD_REQUEST;
        errorMessage = "Coupon service not properly initialized";
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      return res.status(statusCode).json({
        success: false,
        data: null,
        message: errorMessage,
        errors: err.message || null,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
