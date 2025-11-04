// src/services/answerEngine.service.ts
import { logger } from "@repo/common";
import { autoInjectable } from "tsyringe";
import SubmissionRepository from "../repositories/userSubmission.repository";
import ContestRepository from "../repositories/contest.repository";
import UserContestRepository from "../repositories/userContest.repository";

/**
 * Answer Engine Service
 * Evaluates user submissions based on live match data
 * Calculates scores and maintains leaderboards
 */
@autoInjectable()
export default class AnswerEngineService {
  private submissionRepo: SubmissionRepository;
  private contestRepo: ContestRepository;
  private userContestRepo: UserContestRepository;

  constructor() {
    this.submissionRepo = new SubmissionRepository();
    this.contestRepo = new ContestRepository();
    this.userContestRepo = new UserContestRepository();
  }

  /**
   * Process live match data and evaluate answers
   */
  public async processLiveData(matchId: string, liveData: any) {
    try {
      logger.info(`Processing live data for match ${matchId}`);

      // Get all running contests for this match
      const contests = await this.contestRepo.findByMatchId(matchId);
      const runningContests = contests.filter(c => c.status === "running");

      if (!runningContests || runningContests.length === 0) {
        logger.debug(`No running contests found for match ${matchId}`);
        return;
      }

      // Process each contest
      for (const contest of runningContests) {
        await this.evaluateContestSubmissions(contest, liveData);
      }
    } catch (error: any) {
      logger.error(`Error processing live data: ${error?.message}`);
      throw error;
    }
  }

  /**
   * Evaluate all submissions for a contest
   */
  private async evaluateContestSubmissions(contest: any, liveData: any) {
    try {
      logger.info(`Evaluating submissions for contest ${contest.id}`);

      // Get all submissions for this contest
      const submissions = await this.submissionRepo.findByContestId(contest.id);

      if (!submissions || submissions.length === 0) {
        logger.debug(`No submissions found for contest ${contest.id}`);
        return;
      }

      // Evaluate each submission
      const evaluatedSubmissions = [];
      for (const submission of submissions) {
        const score = await this.calculateScore(submission, contest, liveData);
        evaluatedSubmissions.push({
          submissionId: submission.id,
          userId: submission.userId,
          score,
        });
      }

      // Update submissions with new scores
      await this.updateSubmissionScores(evaluatedSubmissions);

      // Recalculate leaderboard
      await this.updateLeaderboard(contest.id, evaluatedSubmissions);
    } catch (error: any) {
      logger.error(
        `Error evaluating contest ${contest.id} submissions: ${error?.message}`
      );
    }
  }

  /**
   * Calculate score for a single submission
   */
  private async calculateScore(
    submission: any,
    contest: any,
    liveData: any
  ): Promise<number> {
    try {
      let totalScore = 0;
      const answers = submission.answers || {};
      const questions = contest.questions || [];

      // Iterate through each question
      for (const question of questions) {
        const userAnswer = answers[question.id];
        
        if (!userAnswer) {
          continue; // No answer provided
        }

        // Evaluate answer based on question type
        const isCorrect = this.evaluateAnswer(
          question,
          userAnswer,
          liveData
        );

        if (isCorrect) {
          totalScore += contest.pointsPerQuestion || 10;
        }
      }

      return totalScore;
    } catch (error: any) {
      logger.error(`Error calculating score: ${error?.message}`);
      return 0;
    }
  }

  /**
   * Evaluate a single answer
   */
  private evaluateAnswer(
    question: any,
    userAnswer: any,
    liveData: any
  ): boolean {
    try {
      const questionType = question.type;
      const correctAnswer = this.extractCorrectAnswer(question, liveData);

      switch (questionType) {
        case "multiple_choice":
          return userAnswer === correctAnswer;

        case "true_false":
          return userAnswer === correctAnswer;

        case "numeric":
          // Allow some tolerance for numeric answers
          const tolerance = question.tolerance || 0;
          return Math.abs(userAnswer - correctAnswer) <= tolerance;

        case "prediction":
          // For predictions, check if the prediction matches the outcome
          return this.evaluatePrediction(question, userAnswer, liveData);

        default:
          logger.warn(`Unknown question type: ${questionType}`);
          return false;
      }
    } catch (error: any) {
      logger.error(`Error evaluating answer: ${error?.message}`);
      return false;
    }
  }

  /**
   * Extract correct answer from live data
   */
  private extractCorrectAnswer(question: any, liveData: any): any {
    try {
      // This depends on how questions are structured
      // Example: question.dataPath = "score.team_a"
      const dataPath = question.dataPath || question.answerPath;
      
      if (!dataPath) {
        logger.warn(`No data path for question ${question.id}`);
        return null;
      }

      // Navigate through the live data object
      const pathParts = dataPath.split(".");
      let value = liveData;
      
      for (const part of pathParts) {
        if (value && typeof value === "object" && part in value) {
          value = value[part];
        } else {
          return null;
        }
      }

      return value;
    } catch (error: any) {
      logger.error(`Error extracting correct answer: ${error?.message}`);
      return null;
    }
  }

  /**
   * Evaluate prediction-type questions
   */
  private evaluatePrediction(
    question: any,
    userAnswer: any,
    liveData: any
  ): boolean {
    try {
      // Example: "Who will win?" or "Who will score first?"
      const actualOutcome = this.extractCorrectAnswer(question, liveData);
      
      if (!actualOutcome) {
        // Match not completed yet
        return false;
      }

      return userAnswer === actualOutcome;
    } catch (error: any) {
      logger.error(`Error evaluating prediction: ${error?.message}`);
      return false;
    }
  }

  /**
   * Update submission scores in bulk
   */
  private async updateSubmissionScores(
    evaluations: Array<{ submissionId: string; userId: string; score: number }>
  ) {
    try {
      for (const evaluation of evaluations) {
        // await this.submissionRepo.updateScore(
        //   evaluation.submissionId,
        //   evaluation.score
        // );
      }

      logger.info(`Updated ${evaluations.length} submission scores`);
    } catch (error: any) {
      logger.error(`Error updating submission scores: ${error?.message}`);
    }
  }

  /**
   * Update leaderboard based on new scores
   */
  private async updateLeaderboard(
    contestId: string,
    evaluations: Array<{ submissionId: string; userId: string; score: number }>
  ) {
    try {
      // Sort by score descending
      const sortedScores = [...evaluations].sort((a, b) => b.score - a.score);

      // Assign ranks
      let currentRank = 1;
      let previousScore: number | null = null;

      for (let i = 0; i < sortedScores.length; i++) {
        const evaluation = sortedScores[i];

        // Handle ties - same score gets same rank
        if (previousScore !== null && evaluation.score === previousScore) {
          // Keep same rank
        } else {
          currentRank = i + 1;
        }

        // Update user contest with rank
        // await this.userContestRepo.updateRank(
        //   evaluation.userId,
        //   contestId,
        //   currentRank,
        //   evaluation.score
        // );

        previousScore = evaluation.score;
      }

      logger.info(`Updated leaderboard for contest ${contestId}`);
    } catch (error: any) {
      logger.error(`Error updating leaderboard: ${error?.message}`);
    }
  }

  /**
   * Calculate final results and distribute prizes
   */
  public async calculateFinalResults(contestId: string) {
    try {
      logger.info(`Calculating final results for contest ${contestId}`);

      const contest = await this.contestRepo.findOne(contestId);
      if (!contest) {
        throw new Error(`Contest ${contestId} not found`);
      }

      // Get final leaderboard
      const leaderboard = await this.userContestRepo.findByContestId(contestId);
      
      // Sort by rank
      const sortedLeaderboard = leaderboard.sort((a: any, b: any) => {
        return (a.rank || Infinity) - (b.rank || Infinity);
      });

      // Distribute prizes based on prizeBreakdown
      const prizeBreakdown = contest.prizeBreakdown || [];
      
      for (const entry of sortedLeaderboard) {
        const prize = this.calculatePrize((entry as any)?.rank, prizeBreakdown);
        
        if (prize > 0) {
          // Update user contest with winning amount
        //   await this.userContestRepo.updateWinnings(
        //     entry.userId,
        //     contestId,
        //     prize
        //   );

          // TODO: Credit amount to user wallet via Kafka event
          logger.info(
            `User ${entry.userId} won ${prize} in contest ${contestId}`
          );
        }
      }

      logger.info(`Final results calculated for contest ${contestId}`);
    } catch (error: any) {
      logger.error(`Error calculating final results: ${error?.message}`);
      throw error;
    }
  }

  /**
   * Calculate prize for a given rank
   */
  private calculatePrize(rank: number | undefined, prizeBreakdown: any[]): number {
    try {
      if (!rank || !prizeBreakdown || prizeBreakdown.length === 0) {
        return 0;
      }

      // Find the prize slab for this rank
      for (const slab of prizeBreakdown) {
        const from = slab.from || slab.rank;
        const to = slab.to || slab.rank;
        const amount = slab.amount || slab.prize;

        if (rank >= from && rank <= to) {
          return amount;
        }
      }

      return 0;
    } catch (error: any) {
      logger.error(`Error calculating prize: ${error?.message}`);
      return 0;
    }
  }
}
