// src/dtos/coupon-actions.dto.ts

export interface ICreateCouponPayload {
  code: string;
  title: string;
  platform: string; // free string (Swiggy, Zomato, etc.)
  discountType: "flat" | "percent";
  discountValue: number; // e.g., 50 or 20
  minOrderValue: number; // e.g., 249
  expiry: Date; // ISO Date
  status?: "active" | "expired" | "used" | "inactive"; // defaults to "active"
  maxUsePerUser?: number | null;
}

export interface IUpdateCouponPayload {
  code?: string;
  title?: string;
  platform?: string;
  discountType?: "flat" | "percent";
  discountValue?: number;
  minOrderValue?: number;
  expiry?: Date;
  status?: "active" | "expired" | "used" | "inactive";
  maxUsePerUser?: number | null;
}

export interface IToggleCouponStatusPayload {
  id: string;
}

export interface IDeleteCouponPayload {
  id: string;
}
