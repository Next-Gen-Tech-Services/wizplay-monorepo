export interface IUserContestAttributes {
  id: string;
  userId: string;
  contestId: string;
  matchId: string;
  status: "active" | "inactive";
  createdAt?: Date;
  updatedAt?: Date;
}
