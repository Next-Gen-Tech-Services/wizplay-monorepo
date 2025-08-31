export enum UserEvents {
  USER_SEND_OTP = "user_send_otp",
  USER_SEND_EMAIL_OTP = "user_send_email_otp",
  USER_SIGNUP = "user_signup",
  USER_LOGIN = "user_login"
}

export type TOPIC_TYPE = "UserEvents" | "NotificationEvents";

export interface MessageType {
  headers?: Record<string, any>,
  event: UserEvents,
  data: Record<string, any>,
}