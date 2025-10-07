import { BadRequestError, ServerError, logger } from "@repo/common";
import { Transaction } from "sequelize";
import { autoInjectable, inject } from "tsyringe";
import { DB } from "../configs/database.config";
import QuestionRepository from "../repositories/question.repository";
import UserSubmissionRepository from "../repositories/userSubmission.repository";

export interface SubmitAnswersPayload {
  userId: string;
  contestId: string;
  answers: { questionId: string; selectedKey: string }[]; // selectedKey e.g. 'A'
  revealCorrect?: boolean; // whether to include correctKey in response (default false)
}

@autoInjectable()
export default class SubmissionService {
  constructor(
    @inject(QuestionRepository) private questionRepo?: QuestionRepository,
    @inject(UserSubmissionRepository)
    private submissionRepo?: UserSubmissionRepository
  ) {}

  public async submitAnswers(payload: SubmitAnswersPayload) {
    const { userId, contestId, answers, revealCorrect = false } = payload;

    if (
      !userId ||
      !contestId ||
      !Array.isArray(answers) ||
      answers.length === 0
    ) {
      throw new BadRequestError("userId, contestId and answers are required");
    }

    let tx: Transaction | null = null;
    try {
      tx = await DB.sequelize.transaction({
        isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ,
      });

      const qIds = answers.map((a) => a.questionId);
      const questions = await this.questionRepo!.findByIds(qIds, {
        transaction: tx,
      });

      // map questions by id
      const qMap = new Map<string, any>();
      for (const q of questions) qMap.set(q.getDataValue("id"), q);

      let total = 0;
      let max = 0;
      const detailedAnswers: any[] = [];

      for (const ans of answers) {
        const q = qMap.get(ans.questionId);
        if (!q) {
          // treat missing question as zero, but track it
          detailedAnswers.push({
            questionId: ans.questionId,
            selectedKey: ans.selectedKey,
            isCorrect: false,
            earnedPoints: 0,
            correctKey: revealCorrect ? null : undefined,
          });
          continue;
        }

        const correctKey = String(q.getDataValue("correctKey") ?? "")
          .trim()
          .toUpperCase();
        const qPoints =
          (q.getDataValue("points") as number) ??
          (q.getDataValue("pointsPerQuestion") as number) ??
          1;
        max += qPoints;

        const selected = String(ans.selectedKey ?? "")
          .trim()
          .toUpperCase();
        const isCorrect = selected === correctKey;
        const earned = isCorrect ? qPoints : 0;
        total += earned;

        detailedAnswers.push({
          questionId: q.getDataValue("id"),
          selectedKey: ans.selectedKey,
          isCorrect,
          earnedPoints: earned,
          ...(revealCorrect ? { correctKey } : {}),
        });
      }

      // persist submission
      const created = await this.submissionRepo!.create(
        {
          userId,
          contestId,
          totalScore: total,
          maxScore: max,
          answers: detailedAnswers,
        },
        { transaction: tx }
      );

      await tx.commit();

      // return summary (omitting correctKey by default)
      return {
        submissionId: created.getDataValue("id"),
        userId,
        contestId,
        totalScore: total,
        maxScore: max,
        answers: detailedAnswers,
      };
    } catch (err: any) {
      if (tx) {
        try {
          await tx.rollback();
        } catch (e) {}
      }
      logger.error(
        `SubmissionService.submitAnswers error: ${err?.message ?? err}`
      );
      throw new ServerError("Failed to submit answers");
    }
  }

  public async listUserSubmissions(userId: string, limit = 50, offset = 0) {
    return this.submissionRepo!.listByUser(userId, limit, offset);
  }

  public async getSubmissionById(id: string) {
    return this.submissionRepo!.findById(id);
  }
}
