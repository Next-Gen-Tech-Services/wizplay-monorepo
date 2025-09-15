export enum ContestEvents {
  CONTEST_CREATED = "contest_created",
  CONTEST_UPDATED = "contest_updated",
  CONTEST_CANCELLED = "contest_cancelled",
  CONTEST_COMPLETED = "contest_completed",
}

export type TOPIC_TYPE = "ContestEvents" | "NotificationEvents";

export interface MessageType {
  headers?: Record<string, any>;
  event: ContestEvents;
  data: Record<string, any>;
}
