export interface IUserContestAttributes {
  id: string;
  userId: string;
  contestId: string;
  matchId: string;
  status: "active" | "completed";
  score?: number;
  rank?: number;
  createdAt?: Date;
  updatedAt?: Date;
}
