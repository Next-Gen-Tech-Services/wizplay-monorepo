import { v4 as uuidv4 } from "uuid";

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
