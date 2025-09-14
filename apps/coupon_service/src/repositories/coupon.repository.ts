// src/repositories/coupon.repository.ts
import { logger, ServerError } from "@repo/common";
import { Op } from "sequelize";
import { DB, IDatabase } from "../configs/database.config";
import { ICouponAtters } from "../dtos/coupon.dto";
import { Coupon } from "../models/coupon.model";

export default class CouponRepository {
  private _DB: IDatabase = DB;

  constructor() {
    this._DB = DB;
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
}
