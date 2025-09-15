export enum UserEvents {
  USER_SEND_OTP = "user_send_otp",
  USER_SEND_EMAIL_OTP = "user_send_email_otp",
  USER_SIGNUP = "user_signup",
  USER_LOGIN = "user_login",
}

export enum ContestEvents {
  FETCH_CONTEST = "fetch_contest",
}

export type TOPIC_TYPE = "UserEvents" | "NotificationEvents" | "ContestEvents";

export interface MessageType {
  headers?: Record<string, any>;
  event: UserEvents | ContestEvents;
  data: Record<string, any>;
}

export type MatchListQuery = {
  status?: string;
  tournament_key?: string;
  team?: string;
  from?: string;
  to?: string;
  limit?: string;
  offset?: string;
  sort?: "start_at" | "-start_at";
};
