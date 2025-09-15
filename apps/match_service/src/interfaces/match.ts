export interface IScheduleResponse {
  days: IDay[];
}

export interface IDay {
  day: number;
  current_day: boolean;
  matches: IMatch[];
}

export interface IMatch {
  key: string;
  name: string;
  short_name: string;
  sub_title: string;
  status: "completed" | "not_started" | "in_progress";
  start_at: number;
  tournament: ITournament;
  metric_group: string;
  sport: "cricket";
  winner: string | null;
  teams: ITeams;
  venue: IVenue;
  expected_start_at: number | null;
  association: IAssociation;
  messages: any[]; // adjust if you know the structure
  gender: "male" | "female";
  tour_key: string | null;
  format: "t20" | "oneday" | "test" | string;
  estimated_end_date: number;
  completed_date_approximate: number | null;
}

export interface ITournament {
  key: string;
  name: string;
  short_name: string;
  alternate_name: string;
  alternate_short_name: string;
}

export interface ITeams {
  a: ITeam;
  b: ITeam;
}

export interface ITeam {
  key: string;
  code: string;
  name: string;
  alternate_name: string;
  alternate_code: string;
  gender_name: string;
  country_code: string | null;
}

export interface IVenue {
  key: string;
  name: string;
  city: string;
  country: ICountry;
  geolocation: string;
}

export interface ICountry {
  short_code: string;
  code: string;
  name: string;
  official_name: string | null;
  is_region: boolean;
}

export interface IAssociation {
  key: string;
  code: string;
  name: string;
  country: ICountry | null;
  parent: any | null; // adjust if you know the structure
}

export interface IMatchFilters {
  sport?: string | undefined;
  format?: string | undefined;
  gender?: string | undefined;
  status?: string | undefined;
  tournamentKey?: string | undefined;
  winner?: string | undefined;
  name?: string | undefined;
  shortName?: string | undefined;
  metricGroup?: string | undefined;
  startedAfter?: string | undefined;
  startedBefore?: string | undefined;
  teamName?: string | undefined;
  showOnFrontend?: boolean | undefined;
  limit?: number;
  offset?: number;
}
