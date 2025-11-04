export enum KAFKA_EVENTS {
  USER_SIGNUP = "user_signup",
  USER_LOGIN = "user_login",
  USER_SEND_OTP = "user_send_otp",
  USER_ONBOARDED = "user_onboarded",
  CONTEST_FETCH = "contest_fetch",
  CONTEST_FETCH_RESP = "match_fetch_resp",
  USER_ADD_TO_WISHLIST = "user_add_to_wishlist",
  USER_REMOVE_FROM_WISHLIST = "user_remove_from_wishlist",
  GENERATE_CONTEST = "generate_contest",
  MATCH_STATUS_CHANGED = "match_status_changed",
  MATCH_LIVE_DATA_UPDATE = "match_live_data_update",
}
