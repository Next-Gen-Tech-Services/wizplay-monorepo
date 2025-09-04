export enum UserEvents {
  USER_SEND_OTP = "user_send_otp",
  USER_SEND_EMAIL_OTP = "user_send_email_otp",
  USER_SIGNUP = "user_signup",
  USER_LOGIN = "user_login",
}
export type MatchListQuery = {
  status?: string;
  tournament_key?: string;
  team?: string; // partial match on team_a/team_b
  from?: string; // unix seconds
  to?: string; // unix seconds
  limit?: string; // numbers as strings via query
  offset?: string;
  sort?: "start_at" | "-start_at";
};

export type TOPIC_TYPE = "UserEvents" | "NotificationEvents";

export interface MessageType {
  headers?: Record<string, any>;
  event: UserEvents;
  data: Record<string, any>;
}
