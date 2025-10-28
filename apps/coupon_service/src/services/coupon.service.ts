// src/services/coupon.service.ts
import { logger, ServerError } from "@repo/common";
import "tsyringe";
import { autoInjectable } from "tsyringe";
import { ICouponAtters } from "../dtos/coupon.dto";
import CouponRepository from "../repositories/coupon.repository";

interface ContestData {
  id: string;
  matchId: string;
  platform: string;
}

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

  public async assignCoupons(data: ContestData | ContestData[]) {
    try {
      const contests = Array.isArray(data) ? data : [data];
      const results = [];

      for (const contest of contests) {
        // Get unused coupons from repository
        const unusedCoupons = await this.couponRepository.findUnusedCoupons(
          contest.platform,
          100
        );

        // Validate availability
        if (unusedCoupons.length < 3) {
          logger.warn(
            `[coupon-service] Not enough unused coupons for contest ${contest.id}. Found: ${unusedCoupons.length}, needed: 3`
          );
          throw new ServerError(
            `Insufficient unused coupons for platform ${contest.platform}. Available: ${unusedCoupons.length}`
          );
        }

        // Select first 3 (already randomized by repository)
        const selectedCoupons = unusedCoupons.slice(0, 3);

        // Prepare contest coupon data
        const contestCouponData = [
          {
            matchId: contest.matchId,
            contestId: contest.id,
            couponId: selectedCoupons[0].id,
            rank: 1,
          },
          {
            matchId: contest.matchId,
            contestId: contest.id,
            couponId: selectedCoupons[1].id,
            rank: 2,
          },
          {
            matchId: contest.matchId,
            contestId: contest.id,
            couponId: selectedCoupons[2].id,
            rank: 3,
          },
        ];

        // Create assignments via repository
        const contestCoupons =
          await this.couponRepository.createContestCoupons(contestCouponData);

        logger.info(
          `[coupon-service] Successfully assigned 3 coupons to contest ${contest.id}: ` +
            `Rank 1: ${selectedCoupons[0].code}, ` +
            `Rank 2: ${selectedCoupons[1].code}, ` +
            `Rank 3: ${selectedCoupons[2].code}`
        );

        results.push({
          contestId: contest.id,
          matchId: contest.matchId,
          assignedCoupons: contestCoupons.map((cc: any, index: any) => ({
            rank: cc.rank,
            couponId: cc.couponId,
            couponCode: selectedCoupons[index].code,
            couponTitle: selectedCoupons[index].title,
            discountValue: selectedCoupons[index].discountValue,
            discountType: selectedCoupons[index].discountType,
          })),
        });
      }

      return {
        success: true,
        count: results.length,
        data: results,
      };
    } catch (error: any) {
      logger.error(
        `[coupon-service] error assigning coupons to contests: ${error.message}`
      );
      throw new ServerError(error?.message || "Error assigning coupons");
    }
  }
}
