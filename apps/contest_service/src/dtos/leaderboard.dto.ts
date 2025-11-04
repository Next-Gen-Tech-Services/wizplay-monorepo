// src/dtos/leaderboard.dto.ts

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName?: string;
  totalScore: number;
  maxScore: number;
  percentage: number;
  submittedAt?: Date;
  contestId: string;
  contestTitle?: string;
}

export interface UserRankResponse {
  userId: string;
  contestId: string;
  rank: number;
  totalScore: number;
  maxScore: number;
  percentage: number;
  totalParticipants: number;
  percentile: number; // e.g., top 10%
}

export interface ContestLeaderboardResponse {
  contestId: string;
  contestTitle?: string;
  totalParticipants: number;
  leaderboard: LeaderboardEntry[];
  userRank?: UserRankResponse; // Current user's rank if userId provided
}

export interface MatchLeaderboardResponse {
  matchId: string;
  totalContests: number;
  totalParticipants: number;
  contests: Array<{
    contestId: string;
    contestTitle: string;
    topPerformers: LeaderboardEntry[];
  }>;
}

export interface GlobalLeaderboardEntry {
  rank: number;
  userId: string;
  userName?: string;
  totalContestsPlayed: number;
  totalScore: number;
  averageScore: number;
  winCount: number;
}

export interface LeaderboardQueryParams {
  limit?: number;
  offset?: number;
  userId?: string; // To highlight user's position
}
