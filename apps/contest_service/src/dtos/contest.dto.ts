// src/dtos/contest.dto.ts
export interface CreateContestPayload {
  matchId: string;
  name: string;
  description?: string;
  startAt?: number; // unix seconds
  endAt?: number;
  maxParticipants?: number;
  entryFee?: number;
  prizePool?: number;
  platform?: string;
  status: "scheduled" | "running" | "completed" | "cancelled";
}

export interface UpdateContestPayload extends Partial<CreateContestPayload> {}

export interface CreateQuestionPayload {
  contestId: string;
  text: string;
  options: string[];
  correctIndex: number;
  points?: number;
}
