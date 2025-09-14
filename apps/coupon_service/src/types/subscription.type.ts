// src/types/coupon.events.ts
export enum CouponEvents {
  COUPON_CREATED = "coupon_created",
  COUPON_UPDATED = "coupon_updated",
  COUPON_DELETED = "coupon_deleted",
  COUPON_TOGGLED = "coupon_toggled", // active/inactive
  COUPON_USED = "coupon_used", // when applied on an order
}

export type TOPIC_TYPE = "CouponEvents";

export interface MessageType<T = any> {
  headers?: Record<string, any>;
  event: CouponEvents; // allow both enums
  data: T; // strongly typed payload
}
