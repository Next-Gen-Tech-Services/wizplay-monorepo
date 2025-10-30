// src/controllers/coupon.controller.ts
import { STATUS_CODE } from "@repo/common";
import { Request, Response } from "express";
import "tsyringe";
import { autoInjectable } from "tsyringe";
import CouponService from "../services/coupon.service";

@autoInjectable()
export default class CouponController {
  constructor(private readonly couponService: CouponService) { }

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

  /** Assign Mannual Coupons */
  public async assignMannualCoupons(req: Request, res: Response) {
    const result = await this.couponService.assignMannualCoupons(req.body);
    return res.status(STATUS_CODE.SUCCESS).json({
      success: true,
      data: result,
      message: "Coupons Assigned",
      errors: null,
      timestamp: new Date().toISOString(),
    });
  }
}
