// src/repositories/coupon.repository.ts
import { logger, ServerError, NotificationHelper } from "@repo/common";
import axios from "axios";
import { Op, QueryTypes } from "sequelize";
import { DB, IDatabase } from "../configs/database.config";
import ServerConfigs from "../configs/server.config";
import { ICouponAtters } from "../dtos/coupon.dto";
import { Coupon } from "../models/coupon.model";

export default class CouponRepository {
  private _DB: IDatabase = DB;
  private notificationHelper: NotificationHelper;

  constructor() {
    this._DB = DB;
    this.notificationHelper = new NotificationHelper(
      ServerConfigs.NOTIFICATION_SERVICE_URL
    );
  }

  /** Just a test helper */
  public async getTestData(): Promise<any> {
    return { service: "coupon-repository", status: "ok" };
  }

  /** Create coupon */
  public async createCoupon(data: Partial<ICouponAtters>): Promise<Coupon> {
    try {
      const coupon = await this._DB.Coupon.create(data as any);
      return coupon.toJSON() as Coupon;
    } catch (error: any) {
      logger.error(`Database Error: ${error}`);
      throw new ServerError("Error creating coupon");
    }
  }

  /** Find by ID */
  public async getCouponById(id: string): Promise<Coupon | null> {
    try {
      const coupon = await this._DB.Coupon.findByPk(id);
      return coupon ? (coupon.toJSON() as Coupon) : null;
    } catch (error: any) {
      logger.error(`Database Error: ${error}`);
      throw new ServerError("Error fetching coupon");
    }
  }

  /** List with filters */
  public async listCoupons({
    search,
    status,
    platform,
    limit = 10,
    offset = 0,
  }: {
    search?: string;
    status?: string;
    platform?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ rows: Coupon[]; count: number }> {
    try {
      const where: any = {};
      if (status && status !== "all") where.status = status;
      if (platform && platform !== "all") where.platform = platform;
      if (search) {
        where[Op.or] = [
          { code: { [Op.iLike]: `%${search}%` } },
          { title: { [Op.iLike]: `%${search}%` } },
        ];
      }

      const { rows, count } = await this._DB.Coupon.findAndCountAll({
        where,
        order: [["created_at", "DESC"]],
        limit,
        offset,
      });

      return { rows, count };
    } catch (error: any) {
      logger.error(`Database Error: ${error}`);
      throw new ServerError("Error listing coupons");
    }
  }

  /** Update coupon */
  public async updateCoupon(
    id: string,
    patch: Partial<ICouponAtters>
  ): Promise<Coupon | null> {
    try {
      const [_, rows] = await this._DB.Coupon.update(patch, {
        where: { id },
        returning: true,
      });
      return rows.length > 0 ? (rows[0].toJSON() as Coupon) : null;
    } catch (error: any) {
      logger.error(`Database Error: ${error}`);
      throw new ServerError("Error updating coupon");
    }
  }

  /** Delete coupon */
  public async deleteCoupon(id: string): Promise<boolean> {
    try {
      const count = await this._DB.Coupon.destroy({ where: { id } });
      return count > 0;
    } catch (error: any) {
      logger.error(`Database Error: ${error}`);
      throw new ServerError("Error deleting coupon");
    }
  }

  /** Toggle status */
  public async toggleCouponActive(id: string): Promise<Coupon | null> {
    try {
      const coupon = await this._DB.Coupon.findByPk(id);
      if (!coupon) return null;

      coupon.status = coupon.status === "active" ? "inactive" : "active";
      await coupon.save();
      return coupon.toJSON() as Coupon;
    } catch (error: any) {
      logger.error(`Database Error: ${error}`);
      throw new ServerError("Error toggling coupon");
    }
  }

  /** Find unused coupons by platform */
  public async findUnusedCoupons(
    limit: number = 100
  ): Promise<Coupon[]> {
    try {
      const coupons = await this._DB.Coupon.findAll({
        where: {
          status: "active",
          expiry: {
            [Op.gt]: new Date(),
          },
          id: {
            [Op.notIn]: this._DB.sequelize.literal(
              `(SELECT coupon_id FROM contest_coupons WHERE coupon_id IS NOT NULL)`
            ),
          },
        },
        limit,
        order: this._DB.sequelize.random(),
      });

      return coupons.map((c) => c.toJSON() as Coupon);
    } catch (error: any) {
      logger.error(`Database Error: ${error}`);
      throw new ServerError("Error finding unused coupons");
    }
  }

  /** Create contest coupon assignments */
  public async createContestCoupons(
    data: Array<{
      matchId: string;
      contestId: string;
      couponId: string;
      rank: number;
    }>
  ): Promise<any[]> {
    try {
      const contestCoupons = await this._DB.ContestCoupon.bulkCreate(data);
      return contestCoupons.map((cc) => cc.toJSON());
    } catch (error: any) {
      logger.error(`Database Error: ${error}`);
      throw new ServerError("Error creating contest coupons");
    }
  }

  /** Update Coupon status */
  public async updateCouponStatus(couponId:string) {
    try {
      const result = await this._DB.Coupon.update({
        status: "used",
      }, {
        where: {
          id: couponId
        }
      });
      return result
    } catch (error:any) {
      logger.error(`Database error: ${error.message}`)
    }
  }

  /** Redeem a coupon for a user (one-time use) */
  public async redeemCoupon(userId: string, couponId: string): Promise<any> {
    try {
      // Check if coupon exists and is active
      const coupon = await this._DB.Coupon.findByPk(couponId);
      if (!coupon) {
        throw new ServerError("Coupon not found");
      }

      if (coupon.status !== "active") {
        throw new ServerError("Coupon is not active");
      }

      if (new Date(coupon.expiry) < new Date()) {
        throw new ServerError("Coupon has expired");
      }

      // Check if coupon is already redeemed
      const existingRedemption = await this._DB.UserCoupon.findOne({
        where: { couponId },
      });

      if (existingRedemption) {
        throw new ServerError("Coupon has already been redeemed");
      }

      // Deduct coins from winning amount only (purchaseAmount)
      const deductAmount = coupon.purchaseAmount;
      
      try {
        const walletResponse = await axios.post(
          `${ServerConfigs.WALLET_SERVICE_URL}/api/v1/wallet/internal/debit-winning`,
          {
            userId,
            amount: deductAmount,
            type: "coupon_purchase",
            referenceId: couponId,
            referenceType: "coupon",
          },
          {
            headers: { "Content-Type": "application/json" },
            timeout: 10000,
          }
        );

        if (!walletResponse.data?.success) {
          throw new ServerError(
            walletResponse.data?.message || "Failed to deduct coins from wallet"
          );
        }

        logger.info(
          `Deducted ${deductAmount} coins from user ${userId}'s winning amount for coupon ${couponId}`
        );
      } catch (walletError: any) {
        logger.error(`Wallet debit error: ${walletError.message}`);
        throw new ServerError(
          walletError.response?.data?.message ||
            walletError.message ||
            "Insufficient winning balance or wallet service unavailable. Only winning amount can be used for reward redemption."
        );
      }

      // Create user coupon redemption
      const userCoupon = await this._DB.UserCoupon.create({
        userId,
        couponId,
        redeemedAt: new Date(),
      });

      // Update coupon status to used
      await this._DB.Coupon.update(
        { status: "used" },
        { where: { id: couponId }, validate: false }
      );

      // Send notification to user
      await this.notificationHelper.sendNotification({
        recipientType: "user_id",
        userId,
        type: "coupon_redeemed",
        title: "🎟️ Coupon Redeemed Successfully!",
        body: `You've redeemed coupon "${coupon.code}" for ${deductAmount} coins. Enjoy your ${coupon.discountType === "flat" ? `₹${coupon.discountValue}` : `${coupon.discountValue}%`} discount on ${coupon.platform}!`,
        data: {
          couponId: coupon.id,
          couponCode: coupon.code,
          deductedAmount: deductAmount.toString(),
          discountValue: coupon.discountValue.toString(),
          discountType: coupon.discountType,
          platform: coupon.platform,
        },
      });

      return {
        userCoupon: userCoupon.toJSON(),
        coupon: coupon.toJSON(),
      };
    } catch (error: any) {
      logger.error(`Database Error: ${error.message}`);
      throw error instanceof ServerError ? error : new ServerError("Error redeeming coupon");
    }
  }

  /** Get available coupons (not yet redeemed) */
  public async getAvailableCoupons({
    limit = 10,
    offset = 0,
  }: {
    limit?: number;
    offset?: number;
  }): Promise<{ rows: Coupon[]; count: number }> {
    try {
      // Use a subquery that returns empty array if table doesn't exist or is empty
      const redeemedCouponIds = await this._DB.sequelize.query(
        `SELECT COALESCE(array_agg(coupon_id), '{}') as ids FROM user_coupons WHERE coupon_id IS NOT NULL`,
        { type: QueryTypes.SELECT }
      );

      const excludeIds = (redeemedCouponIds[0] as any)?.ids || [];

      const where: any = {
        status: "active",
        expiry: {
          [Op.gt]: new Date(),
        },
      };

      // Only add the exclusion if there are actually redeemed coupons
      if (excludeIds.length > 0) {
        where.id = {
          [Op.notIn]: excludeIds,
        };
      }

      const { rows, count } = await this._DB.Coupon.findAndCountAll({
        where,
        order: [["created_at", "DESC"]],
        limit,
        offset,
      });

      return { rows, count };
    } catch (error: any) {
      logger.error(`Database Error: ${error}`);
      throw new ServerError("Error fetching available coupons");
    }
  }

  /** Get user's redeemed coupons */
  public async getUserRedeemedCoupons(userId: string): Promise<any[]> {
    try {
      const userCoupons = await this._DB.UserCoupon.findAll({
        where: { userId },
        include: [
          {
            model: this._DB.Coupon,
            as: "coupon",
          },
        ],
        order: [["redeemed_at", "DESC"]],
      });

      return userCoupons.map((uc) => uc.toJSON());
    } catch (error: any) {
      logger.error(`Database Error: ${error}`);
      throw new ServerError("Error fetching user redeemed coupons");
    }
  }

  /** Get coupon statistics for analytics dashboard */
  public async getCouponStats(): Promise<any> {
    try {
      // Check if the tables exist first
      const tableExists = await this.checkTablesExist();
      
      if (!tableExists) {
        logger.warn(`[CouponRepository] Coupon tables not found, returning default stats`);
        return {
          total: 0,
          active: 0,
          expired: 0,
          redeemed: 0,
          totalValue: 0,
        };
      }

      const [
        total,
        active,
        expired,
        redeemedCount,
        totalDiscountValue
      ] = await Promise.all([
        // Total coupons
        this._DB.Coupon.count(),
        
        // Active coupons (not expired and status active)
        this._DB.Coupon.count({
          where: {
            status: 'active',
            expiry: { [Op.gt]: new Date() }
          }
        }),
        
        // Expired coupons
        this._DB.Coupon.count({
          where: {
            [Op.or]: [
              { expiry: { [Op.lt]: new Date() } },
              { status: 'expired' }
            ]
          }
        }),
        
        // Redeemed coupons count
        this._DB.UserCoupon.count(),
        
        // Total discount value of all active coupons
        this._DB.Coupon.sum('discountValue', {
          where: {
            status: 'active',
            discountType: 'flat'
          }
        }) || 0
      ]);

      return {
        total,
        active,
        expired,
        redeemed: redeemedCount,
        totalValue: totalDiscountValue,
      };
    } catch (error: any) {
      logger.error(`[CouponRepository] getCouponStats database error: ${error.message}`);
      logger.error(`[CouponRepository] Error details: ${error.stack}`);
      
      // Check if it's a database connection issue
      if (error.name === 'SequelizeConnectionError') {
        throw new ServerError("Database connection error while fetching coupon statistics");
      }
      
      // Check if it's a table doesn't exist error
      if (error.message && (error.message.includes('does not exist') || error.message.includes('doesn\'t exist'))) {
        throw new ServerError("Coupon tables not found - please run database migrations");
      }
      
      throw new ServerError(`Error fetching coupon statistics: ${error.message}`);
    }
  }

  /** Assign coupons to contest winners */
  public async assignCouponsToWinners(
    contestId: string,
    winners: Array<{
      userId: string;
      rank: number;
    }>
  ): Promise<any[]> {
    try {
      logger.info(`[COUPON-REPO] Assigning coupons to ${winners.length} winners for contest ${contestId}`);

      // Get available contest coupons for this contest
      const contestCoupons = await this._DB.ContestCoupon.findAll({
        where: {
          contestId,
          userId: null, // Only unassigned coupons
        },
        order: [['rank', 'ASC']],
      });

      if (contestCoupons.length === 0) {
        logger.warn(`[COUPON-REPO] No contest coupons found for contest ${contestId}`);
        return [];
      }

      const assignments = [];

      for (const winner of winners) {
        // Find the coupon for this rank
        const contestCoupon = contestCoupons.find(cc => cc.rank === winner.rank);
        
        if (contestCoupon) {
          // Update the contest coupon with the winner's userId
          await this._DB.ContestCoupon.update(
            { 
              userId: winner.userId,
              assignedAt: new Date()
            },
            { 
              where: { id: contestCoupon.id } 
            }
          );

          // Create user coupon entry for redemption
          const userCoupon = await this._DB.UserCoupon.create({
            userId: winner.userId,
            couponId: contestCoupon.couponId,
            redeemedAt: new Date(),
          });

          assignments.push({
            contestCouponId: contestCoupon.id,
            userId: winner.userId,
            rank: winner.rank,
            couponId: contestCoupon.couponId,
            userCouponId: userCoupon.id,
          });

          logger.info(`[COUPON-REPO] Assigned coupon ${contestCoupon.couponId} to user ${winner.userId} (rank ${winner.rank})`);
        } else {
          logger.warn(`[COUPON-REPO] No coupon available for rank ${winner.rank} in contest ${contestId}`);
        }
      }

      logger.info(`[COUPON-REPO] Successfully assigned ${assignments.length} coupons for contest ${contestId}`);
      return assignments;
    } catch (error: any) {
      logger.error(`[COUPON-REPO] Error assigning coupons to winners: ${error.message}`);
      throw new ServerError(error?.message || "Error assigning coupons to winners");
    }
  }

  /** Get contest coupon assignments for admin view */
  public async getContestCouponAssignments(
    contestId?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<any[]> {
    try {
      const whereClause: any = {};
      if (contestId) {
        whereClause.contestId = contestId;
      }

      const assignments = await this._DB.ContestCoupon.findAll({
        where: whereClause,
        include: [
          {
            model: this._DB.Coupon,
            as: 'coupon',
            attributes: ['id', 'code', 'title', 'discountType', 'discountValue', 'status'],
          },
        ],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
      });

      return assignments.map((assignment: any) => ({
        id: assignment.id,
        contestId: assignment.contestId,
        matchId: assignment.matchId,
        userId: assignment.userId,
        rank: assignment.rank,
        assignedAt: assignment.assignedAt,
        createdAt: assignment.createdAt,
        coupon: assignment.coupon ? {
          id: assignment.coupon.id,
          code: assignment.coupon.code,
          title: assignment.coupon.title,
          discountType: assignment.coupon.discountType,
          discountValue: assignment.coupon.discountValue,
          status: assignment.coupon.status,
        } : null,
        assignmentReason: 'contest_winning',
      }));
    } catch (error: any) {
      logger.error(`[COUPON-REPO] Error getting contest coupon assignments: ${error.message}`);
      throw new ServerError(error?.message || "Error getting contest coupon assignments");
    }
  }

  /** Check if coupon tables exist in the database */
  private async checkTablesExist(): Promise<boolean> {
    try {
      await Promise.all([
        this._DB.sequelize.query('SELECT 1 FROM "coupons" LIMIT 1', { type: QueryTypes.SELECT }),
        this._DB.sequelize.query('SELECT 1 FROM "user_coupons" LIMIT 1', { type: QueryTypes.SELECT })
      ]);
      return true;
    } catch (error: any) {
      if (error.message && (error.message.includes('does not exist') || error.message.includes('doesn\'t exist'))) {
        return false;
      }
      // For other errors, we'll let them bubble up
      throw error;
    }
  }
}
