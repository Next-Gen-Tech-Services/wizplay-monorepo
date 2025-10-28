// src/types/coupon.events.ts

export enum KAFKA_EVENTS {
  COUPON_CREATED = "coupon_created",
  COUPON_UPDATED = "coupon_updated",
  COUPON_DELETED = "coupon_deleted",
  COUPON_TOGGLED = "coupon_toggled", // active/inactive
  COUPON_USED = "coupon_used", // when a user applies a coupon
  GENERATE_CONTEST = "generate_contest",
}
