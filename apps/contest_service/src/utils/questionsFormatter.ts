import { v4 as uuidv4 } from "uuid";
// src/utils/contestFormatter.ts
import { IContestAttrs } from "../models/contest.model";
import { IQuestionAttrs } from "../models/question.model";

export function formatQuestions(
  data: { question: string; options: string[] }[],
  contestId: string,
  matchId: string
) {
  return data?.map((q) => ({
    question: q.question,
    options: q.options.map((opt) => ({
      id: uuidv4(),
      text: opt,
    })),
    contestId: contestId,
    matchId: matchId,
    points: 1,
  }));
}

/**
 * Format contest data for Contest.bulkCreate()
 */
export function formatContestsForBulkInsert(
  contests: any[],
  matchId: string
): IContestAttrs[] {
  return contests.map((contest) => ({
    id: contest.id ?? uuidv4(),
    matchId,
    title: contest.title ?? contest.type ?? "Cricket Contest",
    description: contest.description ?? null,
    type: contest.type ?? null,
    difficulty: contest.difficulty?.toLowerCase() ?? null,
    startAt: contest.startAt ?? null,
    endAt: contest.endAt ?? null,
    entryFee: contest.entryFee ? parseInt(contest.entryFee) : 0,
    prizePool: contest.prizePool ? parseInt(contest.prizePool) : 0,
    pointsPerQuestion: contest.pointsPerQuestion ?? null,
    questionsCount: contest.questions_count ?? contest.questionsCount ?? 0,
    totalSpots: contest.totalSpots ?? null,
    filledSpots: contest.filledSpots ?? 0,
    displayEnabled:
      contest.displayEnabled ?? contest.contest_display_enabled ?? true,
    isPopular: contest.isPopular ?? false,
    joinDeadline: contest.joinDeadline ?? null,
    resultTime: contest.resultTime ?? null,
    timeCommitment: contest.timeCommitment ?? null,
    platform: contest.platform ?? "default",
    status: "upcoming",
  }));
}

/**
 * Format questions for Question.bulkCreate()
 */
export function formatQuestionsForBulkInsert(
  contests: any[],
  matchId: string
): IQuestionAttrs[] {
  const questions: IQuestionAttrs[] = [];

  contests.forEach((contest) => {
    contest.questions?.forEach((q: any) => {
      questions.push({
        id: uuidv4(),
        contestId: contest.id,
        matchId,
        question: q.question_text ?? q.question,
        options: q.options ?? [],
        ansKey: q.correct_answer ?? null,
        points: contest.pointsPerQuestion ?? 0,
      });
    });
  });

  return questions;
}
