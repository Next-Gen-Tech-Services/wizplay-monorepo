export interface IUserContestAttributes {
  id: string;
  userId: string;
  contestId: string;
  matchId: string;
  status: "active" | "completed";
  createdAt?: Date;
  updatedAt?: Date;
}
