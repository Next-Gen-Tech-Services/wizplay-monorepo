export interface IMatchAttrs {
  id: string;
  match_key: string;
  name?: string | null;
  short_name?: string | null;

  tournament_key?: string | null;
  metric_group?: string | null;
  format?: "t20" | "oneday" | "test" | string | null;

  venue_name?: string | null;

  team_a?: string | null;
  team_b?: string | null;

  status?: "not_started" | "live" | "completed" | string | null;
  result_msg?: string | null;

  start_at?: Date | null; // stored as Date (from epoch seconds)
  raw_json?: any | null;

  display_on_frontend?: boolean;
  contests_generated?: boolean;
  contests_updated_at?: Date | null;

  createdAt?: Date;
  updatedAt?: Date;
}
