import { logger } from "@repo/common";
import ContestRepository from "../repositories/contest.repository";
import { ContestStatus } from "../models/contest.model";
import ContestService from "./contest.service";

/**
 * Contest Status Service
 * Handles automatic contest status transitions based on live match data
 */

interface SimplifiedMatch {
    match: MatchInfo;
    teams: TeamsInfo;
    live: LiveData | null;
    toss: TossInfo | null;
}

interface MatchInfo {
    id: string;
    title?: string;
    shortName?: string;
    status: string;
    playStatus: string;
    format: string;
    startTime?: { epoch: number; utc: string; ist: string }; // From transformed data
}

interface TeamsInfo {
    a: { key: string; name: string; code?: string };
    b: { key: string; name: string; code?: string };
}

interface LiveData {
    innings: string; // "b_1" format (team_inningsNumber)
    battingTeam?: string;
    bowlingTeam?: string;
    currentScore: { 
        runs: number; 
        wickets: number; 
        overs: string; 
        runRate?: number;
        display?: string;
    };
}

interface TossInfo {
    winner: string; // "a" or "b"
    winnerName?: string;
    decision: string; // "bat" or "bowl"
}

interface StatusUpdateResult {
    contestId: string;
    oldStatus: ContestStatus;
    newStatus: ContestStatus;
    type: string;
    reason: string;
}

class ContestStatusService {
    private contestRepository: ContestRepository;

    constructor() {
        this.contestRepository = new ContestRepository();
    }

    /**
     * Update contest statuses based on live match data
     * Called from match_service livematch webhook
     */
    async updateContestStatuses(matchId: string, liveMatchData: SimplifiedMatch): Promise<StatusUpdateResult[]> {
        try {
            logger.info(`[CONTEST-STATUS] Processing status updates for match: ${matchId}`);

            const results: StatusUpdateResult[] = [];

            // Get all non-completed contests for this match
            const contests = await this.contestRepository.getContestsByMatchId(matchId);
            
            if (!contests || contests.length === 0) {
                logger.info(`[CONTEST-STATUS] No contests found for match: ${matchId}`);
                return results;
            }

            logger.info(`[CONTEST-STATUS] Found ${contests.length} contests to check`);

            // Extract match data
            const matchStatus = liveMatchData.match?.status || "";
            const playStatus = liveMatchData.match?.playStatus || "";
            const matchFormat = liveMatchData.match?.format || "";
            const matchStartAt = liveMatchData.match?.startTime?.epoch;
            const rawInnings = liveMatchData.live?.innings || "";
            const currentInnings = this.normalizeInnings(rawInnings); // Convert "b_1" to "innings1"
            const currentOvers = this.parseOvers(liveMatchData.live?.currentScore?.overs || "0.0");
            const tossCompleted = !!liveMatchData.toss?.winner;

            logger.info(`[CONTEST-STATUS] Match state: status=${matchStatus}, playStatus=${playStatus}, format=${matchFormat}, startAt=${matchStartAt}, rawInnings=${rawInnings}, normalizedInnings=${currentInnings}, overs=${currentOvers.toFixed(1)}, toss=${tossCompleted}`);

            // Check if match is cancelled/abandoned
            if (matchStatus === "cancelled" || matchStatus === "abandoned") {
                return await this.cancelAllContests(contests);
            }

            // Process each contest
            for (const contest of contests) {
                const currentStatus = contest.status;
                const contestType = contest.type || "";

                logger.info(`[CONTEST-STATUS] Checking contest ${contest.id}: type=${contestType}, currentStatus=${currentStatus}`);

                // Skip if already completed or cancelled
                if (currentStatus === "completed" || currentStatus === "cancelled") {
                    logger.info(`[CONTEST-STATUS] Skipping contest ${contest.id} - already ${currentStatus}`);
                    continue;
                }

                // Determine new status based on contest type and match state
                const newStatus = this.determineNewStatus(
                    currentStatus,
                    contestType,
                    matchStatus,
                    playStatus,
                    currentInnings,
                    currentOvers,
                    tossCompleted,
                    matchFormat,
                    matchStartAt
                );

                logger.info(`[CONTEST-STATUS] Contest ${contest.id} determination: ${currentStatus} → ${newStatus || 'no change'}`);

                // Update if status changed
                if (newStatus && newStatus !== currentStatus) {
                    await this.contestRepository.updateContestStatus(contest.id, newStatus);
                    
                    const result: StatusUpdateResult = {
                        contestId: contest.id,
                        oldStatus: currentStatus,
                        newStatus: newStatus,
                        type: contestType,
                        reason: this.getTransitionReason(contestType, currentStatus, newStatus, currentOvers, currentInnings)
                    };
                    
                    results.push(result);
                    logger.info(`[CONTEST-STATUS] Contest ${contest.id} | ${contestType} | ${currentStatus} → ${newStatus} | ${result.reason}`);
                    
                    // If status moved to calculating, generate answers and calculate results
                    if (newStatus === "calculating") {
                        this.processContestCalculation(contest.id, matchId, liveMatchData).catch(err => {
                            logger.error(`[CONTEST-STATUS] Error processing calculation for contest ${contest.id}: ${err?.message || err}`);
                        });
                    }
                }
            }

            return results;
        } catch (error) {
            logger.error(`[CONTEST-STATUS] Error updating contest statuses: ${error}`);
            throw error;
        }
    }

    /**
     * Determine new status based on contest type and match state
     * 
     * Contest Flow by Type:
     * 
     * PRE-MATCH:
     * - upcoming: 3+ hours before match
     * - live: 3 hours before match until toss
     * - joining_closed: After toss
     * - calculating: After both innings complete
     * - completed: Results declared
     * 
     * POWERPLAY/MIDDLE/DEATH (all phases):
     * - upcoming: Before toss
     * - live: After toss, before first ball of phase
     * - joining_closed: After first ball of phase
     * - calculating: After phase ends (6 overs for T20 powerplay, etc)
     * - completed: Results declared
     */
    private determineNewStatus(
        currentStatus: ContestStatus,
        contestType: string,
        matchStatus: string,
        playStatus: string,
        currentInnings: string,
        currentOvers: number,
        tossCompleted: boolean,
        matchFormat: string,
        matchStartAt?: number
    ): ContestStatus | null {
        
        // Normalize contest type for checking (handle both formats: odi_prematch and prematch)
        const normalizedType = contestType.toLowerCase().replace(/_/g, '');
        
        // Normalize current status (handle old 'scheduled' as 'upcoming')
        const normalizedCurrentStatus = (currentStatus === 'scheduled' as any) ? 'upcoming' : currentStatus;
        
        const now = Date.now();
        const threeHoursInMs = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
        const matchStartTime = matchStartAt ? matchStartAt * 1000 : now; // Convert to milliseconds
        const timeUntilMatch = matchStartTime - now;

        // ============= PRE-MATCH CONTEST LOGIC =============
        if (normalizedType.includes("prematch")) {
            if (normalizedCurrentStatus === "upcoming") {
                // Go live 3 hours before match
                if (timeUntilMatch <= threeHoursInMs) {
                    return "live";
                }
            }
            
            if (normalizedCurrentStatus === "live") {
                // Close joining after toss
                if (tossCompleted) {
                    return "joining_closed";
                }
            }
            
            if (normalizedCurrentStatus === "joining_closed") {
                // Move to calculating after both innings complete
                if (matchStatus === "completed" || currentInnings === "innings2_completed") {
                    return "calculating";
                }
            }
            
            return null;
        }

        // ============= PHASE-BASED CONTEST LOGIC (Powerplay, Middle, Death) =============
        
        const phaseStart = this.getPhaseStartOver(contestType, matchFormat);
        const phaseEnd = this.getPhaseEndOver(contestType, matchFormat);
        const correctInnings = this.getContestInnings(contestType);
        
        console.log(`Phase-based contest logic: contestType=${contestType}, phaseStart=${phaseStart}, phaseEnd=${phaseEnd}, correctInnings=${correctInnings}, currentInnings=${currentInnings}, currentOvers=${currentOvers}`);
        
        logger.info(`[CONTEST-STATUS] Phase logic for ${contestType}: phaseStart=${phaseStart}, phaseEnd=${phaseEnd}, correctInnings=${correctInnings}, currentInnings=${currentInnings}, currentOvers=${currentOvers}, currentStatus=${normalizedCurrentStatus}`);
        
        if (normalizedCurrentStatus === "upcoming") {
            // If innings1 contest and we're already in innings2, skip to calculating
            if (correctInnings === "innings1" && currentInnings === "innings2") {
                return "calculating";
            }
            
            // If innings1 contest and innings1 already completed (at max overs)
            if (correctInnings === "innings1" && currentInnings === "innings1") {
                const maxOvers = this.getMaxOversForFormat(matchFormat);
                if (currentOvers >= maxOvers) {
                    return "calculating";
                }
            }
            
            // Go live after toss but before first ball of phase
            if (tossCompleted && matchStatus === "started") {
                // Check if we're in the correct innings and before the phase starts
                if (currentInnings === correctInnings && currentOvers < phaseStart) {
                    return "live";
                }
                
                // If we're in the correct innings and phase already started, skip to joining_closed
                if (currentInnings === correctInnings && currentOvers >= phaseStart) {
                    return "joining_closed";
                }
                
                // If we're in innings1 but contest is for innings2, go live (waiting for innings2)
                if (correctInnings === "innings2" && currentInnings === "innings1") {
                    return "live";
                }
            }
            
            // Also go live after toss even if match hasn't started yet
            if (tossCompleted && matchStatus !== "started") {
                return "live";
            }
        }
        
        if (normalizedCurrentStatus === "live") {
            // If innings1 contest and we're already in innings2, move to calculating
            if (correctInnings === "innings1" && currentInnings === "innings2") {
                return "calculating";
            }
            
            // If innings1 contest and innings1 already completed (at max overs)
            if (correctInnings === "innings1" && currentInnings === "innings1") {
                const maxOvers = this.getMaxOversForFormat(matchFormat);
                if (currentOvers >= maxOvers) {
                    return "calculating";
                }
            }
            
            // Close joining when first ball of phase is bowled
            if (matchStatus === "started") {
                if (currentInnings === correctInnings && currentOvers >= phaseStart) {
                    return "joining_closed";
                }
            }
        }
        
        if (normalizedCurrentStatus === "joining_closed") {
            // Move to calculating when phase ends
            if (currentInnings === correctInnings && currentOvers >= phaseEnd) {
                return "calculating";
            }
            
            // Also if innings changed and we were watching innings1
            if (correctInnings === "innings1" && currentInnings === "innings2") {
                return "calculating";
            }
            
            // Check if innings1 completed (at max overs for format) and contest is for innings1
            if (correctInnings === "innings1" && currentInnings === "innings1") {
                const maxOvers = this.getMaxOversForFormat(matchFormat);
                if (currentOvers >= maxOvers) {
                    return "calculating";
                }
            }
            
            // Match completed
            if (matchStatus === "completed") {
                return "calculating";
            }
        }

        return null;
    }

    /**
     * Get maximum overs for a format (used to detect end of innings)
     */
    private getMaxOversForFormat(format: string): number {
        const normalized = format.toLowerCase();
        if (normalized.includes("t20") || normalized.includes("twenty")) return 20;
        if (normalized.includes("t10")) return 10;
        if (normalized.includes("odi") || normalized.includes("oneday")) return 50;
        if (normalized.includes("test")) return 999; // Test matches don't have over limits
        
        // If no format specified, return a safe default
        return 20; // Default to T20
    }

    /**
     * Get phase start over based on contest type and format
     */
    private getPhaseStartOver(contestType: string, format: string): number {
        // Try to determine format from contest type if format string is not reliable
        const typeNormalized = contestType.toLowerCase();
        const formatNormalized = format.toLowerCase();
        
        const isT20 = typeNormalized.includes("t20") || formatNormalized.includes("twenty") || formatNormalized.includes("t20");
        const isT10 = typeNormalized.includes("t10") || formatNormalized.includes("t10");
        const isODI = typeNormalized.includes("odi") || formatNormalized.includes("odi") || formatNormalized.includes("oneday");

        if (contestType.includes("powerplay")) {
            return 0; // Over 0.1 onwards
        }

        if (contestType.includes("middle")) {
            if (isT20 || isT10) return 7;
            if (isODI) return 11;
            return 7; // Default to T20
        }

        if (contestType.includes("death")) {
            if (isT20) return 16;
            if (isT10) return 7;
            if (isODI) return 41;
            return 16; // Default to T20
        }

        return 0;
    }

    /**
     * Get phase end over based on contest type and format
     */
    private getPhaseEndOver(contestType: string, format: string): number {
        // Try to determine format from contest type if format string is not reliable
        const typeNormalized = contestType.toLowerCase();
        const formatNormalized = format.toLowerCase();
        
        const isT20 = typeNormalized.includes("t20") || formatNormalized.includes("twenty") || formatNormalized.includes("t20");
        const isT10 = typeNormalized.includes("t10") || formatNormalized.includes("t10");
        const isODI = typeNormalized.includes("odi") || formatNormalized.includes("odi") || formatNormalized.includes("oneday");

        if (contestType.includes("powerplay")) {
            if (isT20 || isT10) return 6;
            if (isODI) return 10;
            return 6; // Default to T20
        }

        if (contestType.includes("middle")) {
            if (isT20) return 15;
            if (isODI) return 40;
            return 15; // Default to T20
        }

        if (contestType.includes("death")) {
            if (isT20) return 20;
            if (isT10) return 10;
            if (isODI) return 50;
            return 20; // Default to T20
        }

        return 999; // Default large number
    }

    /**
     * Normalize innings format from Roanuz API format to our internal format
     * Converts "b_1" → "innings1", "a_2" → "innings2", etc.
     */
    private normalizeInnings(rawInnings: string): string {
        if (!rawInnings) return "";
        
        // Extract innings number from format like "b_1", "a_2"
        const parts = rawInnings.split("_");
        if (parts.length >= 2) {
            const inningsNum = parts[1];
            return `innings${inningsNum}`;
        }
        
        // If already in our format or unknown format, return as is
        return rawInnings;
    }

    /**
     * Get innings from contest type
     * Checks for explicit innings markers like _1, 1_, powerplay1, middle2, etc.
     */
    private getContestInnings(contestType: string): string {
        const normalized = contestType.toLowerCase();
        
        // Check for innings2 patterns first (more specific)
        if (normalized.includes("innings2") || 
            normalized.includes("_2") || 
            normalized.endsWith("2") ||
            normalized.match(/powerplay2|middle2|death2/)) {
            return "innings2";
        }
        
        // Default to innings1 (also matches powerplay1, middle1, death1)
        return "innings1";
    }

    /**
     * Parse overs string to decimal (e.g., "5.3" → 5.5, "6.0" → 6.0)
     */
    private parseOvers(oversStr: string): number {
        const parts = oversStr.split(".");
        const overs = parseInt(parts[0] || "0", 10);
        const balls = parseInt(parts[1] || "0", 10);
        return overs + (balls / 6);
    }

    /**
     * Get human-readable reason for status transition
     */
    private getTransitionReason(
        contestType: string,
        oldStatus: ContestStatus,
        newStatus: ContestStatus,
        currentOvers: number,
        currentInnings: string
    ): string {
        const normalizedType = contestType.toLowerCase().replace(/_/g, '');
        
        if (newStatus === "live") {
            if (normalizedType.includes("prematch")) {
                return "Contest now live - 3 hours before match";
            }
            return "Toss completed - joining now open";
        }

        if (newStatus === "joining_closed") {
            if (normalizedType.includes("prematch")) {
                return "Toss completed - joining closed";
            }
            if (oldStatus === "upcoming") {
                return "Phase already started - joining closed";
            }
            return `First ball bowled at over ${currentOvers.toFixed(1)} - joining closed`;
        }

        if (newStatus === "calculating") {
            if (normalizedType.includes("prematch")) {
                return "Both innings completed - calculating results";
            }
            return `${contestType} phase ended at over ${currentOvers.toFixed(1)} - calculating results`;
        }

        if (newStatus === "completed") {
            return "Results declared";
        }

        if (newStatus === "cancelled") {
            return "Match cancelled/abandoned";
        }

        return `Status changed`;
    }

    /**
     * Cancel all contests for abandoned match
     */
    private async cancelAllContests(contests: any[]): Promise<StatusUpdateResult[]> {
        const results: StatusUpdateResult[] = [];

        for (const contest of contests) {
            if (contest.status !== "cancelled" && contest.status !== "completed") {
                await this.contestRepository.updateContestStatus(contest.id, "cancelled");
                
                results.push({
                    contestId: contest.id,
                    oldStatus: contest.status,
                    newStatus: "cancelled",
                    type: contest.type || "",
                    reason: "Match cancelled/abandoned"
                });

                logger.info(`[CONTEST-STATUS] Contest ${contest.id} cancelled - Match abandoned`);
            }
        }

        return results;
    }

    /**
     * Process contest calculation - Generate answers and calculate user scores
     * Called automatically when contest status moves to "calculating"
     */
    private async processContestCalculation(contestId: string, matchId: string, liveMatchData: SimplifiedMatch): Promise<void> {
        try {
            logger.info(`[CONTEST-CALCULATION] Starting calculation for contest ${contestId}`);

            // Get contest details with questions
            const contest = await this.contestRepository.getContestById(contestId);
            if (!contest) {
                logger.error(`[CONTEST-CALCULATION] Contest ${contestId} not found`);
                return;
            }

            // Get all questions for this contest
            const questions = await this.contestRepository.getQuestionsByContestId(contestId);
            if (!questions || questions.length === 0) {
                logger.warn(`[CONTEST-CALCULATION] No questions found for contest ${contestId}`);
                return;
            }

            logger.info(`[CONTEST-CALCULATION] Processing ${questions.length} questions for contest ${contestId}`);

            // Use contest service for AI answer generation
            const contestService = new ContestService(this.contestRepository);

            // Generate and update answers for each question
            for (const question of questions) {
                try {
                    // Generate answer using AI
                    const result = await contestService.generateAnswers(
                        liveMatchData.match,
                        liveMatchData.live,
                        question
                    );

                    if (result?.data) {
                        // Update question with generated answer
                        await this.contestRepository.updateQuestionAnswer(question.id, result.data);
                        logger.info(`[CONTEST-CALCULATION] Generated answer for question ${question.id}: ${JSON.stringify(result.data)}`);
                    }
                } catch (err: any) {
                    logger.error(`[CONTEST-CALCULATION] Error generating answer for question ${question.id}: ${err?.message || err}`);
                }
            }

            // Calculate scores for all user submissions
            await this.calculateUserScores(contestId);

            // Move contest to completed status
            await this.contestRepository.updateContestStatus(contestId, "completed");
            logger.info(`[CONTEST-CALCULATION] ✅ Contest ${contestId} calculation completed and moved to completed status`);

        } catch (error: any) {
            logger.error(`[CONTEST-CALCULATION] Error processing calculation for contest ${contestId}: ${error?.message || error}`);
            throw error;
        }
    }

    /**
     * Calculate scores for all user submissions in a contest
     */
    private async calculateUserScores(contestId: string): Promise<void> {
        try {
            logger.info(`[CONTEST-CALCULATION] Calculating user scores for contest ${contestId}`);

            // Get all questions with answers
            const questions = await this.contestRepository.getQuestionsByContestId(contestId);
            const questionMap = new Map(questions.map(q => [q.id, q]));

            // Get all user submissions for this contest
            const submissions = await this.contestRepository.getUserSubmissionsByContestId(contestId);
            
            if (!submissions || submissions.length === 0) {
                logger.info(`[CONTEST-CALCULATION] No submissions found for contest ${contestId}`);
                return;
            }

            logger.info(`[CONTEST-CALCULATION] Calculating scores for ${submissions.length} submissions`);

            // Calculate score for each submission
            for (const submission of submissions) {
                try {
                    const question = questionMap.get(submission.questionId);
                    if (!question || !question.ansKey) {
                        continue;
                    }

                    const isCorrect = submission.answer === question.ansKey;
                    const points = isCorrect ? (question.points || 1) : 0;

                    // Update submission with score
                    await this.contestRepository.updateSubmissionScore(submission.id, points, isCorrect);
                    
                } catch (err: any) {
                    logger.error(`[CONTEST-CALCULATION] Error calculating score for submission ${submission.id}: ${err?.message || err}`);
                }
            }

            // Update leaderboard/user contest totals
            await this.updateContestLeaderboard(contestId);
            
            logger.info(`[CONTEST-CALCULATION] ✅ Score calculation completed for contest ${contestId}`);

        } catch (error: any) {
            logger.error(`[CONTEST-CALCULATION] Error calculating user scores: ${error?.message || error}`);
            throw error;
        }
    }

    /**
     * Update contest leaderboard with final scores
     */
    private async updateContestLeaderboard(contestId: string): Promise<void> {
        try {
            // Get total scores per user
            const userScores = await this.contestRepository.getUserContestScores(contestId);
            
            // Update UserContest table with final scores and ranks
            for (const userScore of userScores) {
                await this.contestRepository.updateUserContestScore(
                    contestId,
                    userScore.userId,
                    userScore.totalScore,
                    userScore.rank
                );
            }

            logger.info(`[CONTEST-CALCULATION] Leaderboard updated for contest ${contestId}`);
        } catch (error: any) {
            logger.error(`[CONTEST-CALCULATION] Error updating leaderboard: ${error?.message || error}`);
            throw error;
        }
    }
}

export default new ContestStatusService();
