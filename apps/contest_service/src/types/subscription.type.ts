export enum ContestEvents {
  CONTEST_FETCH = "contest_fetch",
  CONTEST_FETCH_RESP = "match_fetch_resp",
  GENERATE_CONTEST = "generate_contest",
}

export type TOPIC_TYPE = "ContestEvents";

export interface MessageType {
  headers?: Record<string, any>;
  event: ContestEvents;
  data: Record<string, any>;
}
