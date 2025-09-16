// src/dtos/question.dto.ts

export interface CreateQuestionPayload {
  id?: string;
  contestId: string;
  text: string;
  options: string[];
  correctIndex: number;
  points?: number; // defaults to contest.pointsPerQuestion if not provided
}
