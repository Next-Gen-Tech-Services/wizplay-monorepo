// src/dtos/coupon.dto.ts

export type CouponStatus = "active" | "expired" | "used" | "inactive";
export type CouponDiscountType = "flat" | "percent";

export interface ICouponAtters {
  id: string;
  code: string; // e.g., GET50OFF
  title: string; // e.g., Flat ₹50 off on orders above ₹249
  platform: string; // can be Swiggy, Zomato, Blinkit, or any other value
  discountType: CouponDiscountType;
  discountValue: number; // e.g., 50 or 20
  purchaseAmount: number; // e.g., 249
  expiry: Date; // ISO Date
  status: CouponStatus;
  usageCount: number; // total times applied
  maxUsePerUser?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}
