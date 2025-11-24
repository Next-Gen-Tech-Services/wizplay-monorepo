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
  treatNullAnsKeyAsUnscored?: boolean; // default true -> ignore null ansKey questions in maxScore
}

@autoInjectable()
export default class SubmissionService {
  constructor(
    @inject(QuestionRepository) private questionRepo?: QuestionRepository,
    @inject(UserSubmissionRepository)
    private submissionRepo?: UserSubmissionRepository
  ) {}

  public async submitAnswers(payload: SubmitAnswersPayload) {
    const {
      userId,
      contestId,
      answers,
      revealCorrect = false,
      treatNullAnsKeyAsUnscored = true,
    } = payload;

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

      // fetch questions for given ids
      const qIds = answers.map((a) => a.questionId);
      const questions = await this.questionRepo!.findByIds(qIds, {
        transaction: tx,
      });

      // map by id for quick lookup (store plain values for easy flattening)
      const qMap = new Map<string, any>();
      for (const q of questions) {
        // ensure we keep plain values (use get() to get plain object)
        const plainQ = typeof q.get === "function" ? q.get({ plain: true }) : q;
        qMap.set(plainQ.id, plainQ);
      }

      // helper normalize
      const normalize = (v: any) =>
        v === null || v === undefined ? "" : String(v).trim().toLowerCase();

      let total = 0;
      let max = 0;
      const detailedAnswers: any[] = [];

      for (const ans of answers) {
        const q = qMap.get(ans.questionId);

        if (!q) {
          // missing question in DB: record as zero (do not increase max)
          const base = {
            questionId: ans.questionId,
            selectedKey: ans.selectedKey,
            isCorrect: false,
            earnedPoints: 0,
            note: "question not found",
          };
          // no question to flatten
          detailedAnswers.push(base);
          continue;
        }

        // Support both field names 'ansKey' (your data) or 'correctKey' (other code)
        const rawCorrect =
          q.ansKey ?? q.correctKey ?? q.ans_key ?? q.correct_key ?? null;

        // points for question (fallback to 1)
        const qPoints = (q.points ?? q.pointsPerQuestion ?? 1) as number;

        // If question has no correct key
        if (!rawCorrect) {
          if (treatNullAnsKeyAsUnscored) {
            // do not include in maxScore
            const base = {
              questionId: q.id,
              selectedKey: ans.selectedKey,
              isCorrect: false,
              earnedPoints: 0,
              note: "no correct answer configured (unscored)",
            };

            // flatten chosen question fields
            detailedAnswers.push({
              ...base,
              question: q.question ?? null,
              options: q.options ?? null,
            });
            continue;
          } else {
            // include in maxScore but mark incorrect (no correctKey to compare)
            max += qPoints;
            const base = {
              questionId: q.id,
              selectedKey: ans.selectedKey,
              isCorrect: false,
              earnedPoints: 0,
              note: "no correct answer configured",
            };

            detailedAnswers.push({
              ...base,
              question: q.question ?? null,
              options: q.options ?? null,
            });
            continue;
          }
        }

        // normal scoring path
        const correctNorm = normalize(rawCorrect);
        const selectedNorm = normalize(ans.selectedKey);

        max += qPoints;
        const isCorrect = selectedNorm === correctNorm;
        const earned = isCorrect ? qPoints : 0;
        total += earned;

        const answerRecord: any = {
          questionId: q.id,
          selectedKey: ans.selectedKey,
          isCorrect,
          earnedPoints: earned,
        };

        // Only include correctKey if explicitly requested
        if (revealCorrect) {
          answerRecord.correctKey = rawCorrect;
          answerRecord.ansKey = rawCorrect;
        }

        // flatten selected question fields into the answer
        answerRecord.question = q.question ?? null;
        answerRecord.options = q.options ?? null;

        detailedAnswers.push(answerRecord);
      }

      // persist submission (now includes flattened question fields inside answers)
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
        } catch (e) {
          logger.warn("Failed rollback in submitAnswers: " + String(e));
        }
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

  public async getContestSubmissionById(userId: string, id: string) {
    return this.submissionRepo!.findContestSubmissionById(userId, id);
  }
}
