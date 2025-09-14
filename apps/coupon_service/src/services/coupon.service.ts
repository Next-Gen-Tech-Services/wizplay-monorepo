// src/services/coupon.service.ts
import { logger, ServerError } from "@repo/common";
import "tsyringe";
import { autoInjectable } from "tsyringe";
import { ICouponAtters } from "../dtos/coupon.dto";
import CouponRepository from "../repositories/coupon.repository";

@autoInjectable()
export default class CouponService {
  constructor(private readonly couponRepository: CouponRepository) {}

  /** Just a test helper */
  public async fetchTestData() {
    return this.couponRepository.getTestData();
  }

  /** Create coupon */
  public async createCoupon(payload: Partial<ICouponAtters>) {
    try {
      const coupon = await this.couponRepository.createCoupon(payload);
      return {
        data: coupon,
        message: "Coupon created successfully",
      };
    } catch (error: any) {
      logger.error(`[coupon-service] createCoupon error: ${error}`);
      throw new ServerError(error?.message);
    }
  }

  /** List coupons with filters */
  public async listCoupons(filters: {
    search?: string;
    status?: string;
    platform?: string;
    limit?: number;
    offset?: number;
  }) {
    try {
      const { rows, count } = await this.couponRepository.listCoupons(filters);
      return {
        items: rows,
        total: count,
        message: "Coupons fetched successfully",
      };
    } catch (error: any) {
      logger.error(`[coupon-service] listCoupons error: ${error}`);
      throw new ServerError(error?.message);
    }
  }

  /** Get by ID */
  public async getCouponById(id: string) {
    try {
      const coupon = await this.couponRepository.getCouponById(id);
      if (!coupon) {
        throw new ServerError("Coupon not found");
      }
      return coupon;
    } catch (error: any) {
      logger.error(`[coupon-service] getCouponById error: ${error}`);
      throw new ServerError(error?.message);
    }
  }

  /** Update coupon */
  public async updateCoupon(id: string, patch: Partial<ICouponAtters>) {
    try {
      const coupon = await this.couponRepository.updateCoupon(id, patch);
      if (!coupon) {
        throw new ServerError("Coupon not found");
      }
      return coupon;
    } catch (error: any) {
      logger.error(`[coupon-service] updateCoupon error: ${error}`);
      throw new ServerError(error?.message);
    }
  }

  /** Delete coupon */
  public async deleteCoupon(id: string) {
    try {
      const deleted = await this.couponRepository.deleteCoupon(id);
      if (!deleted) {
        throw new ServerError("Coupon not found");
      }
      return true;
    } catch (error: any) {
      logger.error(`[coupon-service] deleteCoupon error: ${error}`);
      throw new ServerError(error?.message);
    }
  }

  /** Toggle coupon active/inactive */
  public async toggleCouponActive(id: string) {
    try {
      const coupon = await this.couponRepository.toggleCouponActive(id);
      if (!coupon) {
        throw new ServerError("Coupon not found");
      }
      return coupon;
    } catch (error: any) {
      logger.error(`[coupon-service] toggleCouponActive error: ${error}`);
      throw new ServerError(error?.message);
    }
  }
}
