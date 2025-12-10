// src/dtos/coupon.dto.ts

export type CouponStatus = "active" | "expired" | "used" | "inactive";
export type CouponDiscountType = "flat" | "percent";

export interface ICouponAtters {
  id: string;
  code: string; 
  title: string;
  platform: string; 
  discountType: CouponDiscountType;
  discountValue: number;
  purchaseAmount: number; 
  expiry: Date; 
  status: CouponStatus;
  usageCount: number; 
  maxUsePerUser?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}
