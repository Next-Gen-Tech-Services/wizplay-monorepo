// src/types/coupon.events.ts

import { KAFKA_EVENTS } from "./events.type";

export interface MessageType<T = any> {
  headers?: Record<string, any>;
  event: KAFKA_EVENTS; // allow both enums
  data: T; // strongly typed payload
}
