export interface ITeamSide {
  key: string;
  code: string;
  name: string;
  alternate_name?: string;
  alternate_code?: string;
  gender_name?: string;
  country_code?: string | null;
}

export interface ITeams {
  a: ITeamSide;
  b: ITeamSide;
}

export interface IMatchAttrs {
  id: string;
  key: string;
  sport: string;
  format: string;
  gender: string;
  tournamentKey?: string | null;
  name: string;
  shortName: string;
  subTitle: string | null;
  status: string;
  metricGroup: string;
  teams: ITeams;
  winner?: string | null;
  startedAt: number;
  endedAt?: number | null;
  expectedStartedAt?: number | null;
  expectedEndedAt: number;
  showOnFrontend: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
