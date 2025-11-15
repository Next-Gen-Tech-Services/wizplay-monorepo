import { logger } from "@repo/common";
import axios from "axios";
import ServerConfigs from "../configs/server.config";
import MatchRepository from "../repositories/match.repository";

/**
 * Contest Completion Service
 * Handles automatic contest completion based on live match data from Roanuz webhook
 */
class ContestCompletionService {
    private contestServiceUrl: string;
    private matchRepository: MatchRepository;

    constructor() {
        this.contestServiceUrl = ServerConfigs.CONTEST_SERVICE_URL || "http://localhost:4005";
        this.matchRepository = new MatchRepository();
    }

    /**
     * Process contest completion based on live match data
     * This is called from the livematch webhook handler
     */
    async processContestCompletion(matchId: string, liveMatchData: any): Promise<void> {
        try {
            // Get all active contests for this match
            const contests = await this.getActiveContests(matchId);

            if (!contests || contests.length === 0) {
                return; // No active contests for this match
            }

            logger.info(`[CONTEST-COMPLETION] Processing ${contests.length} contests for match ${matchId}`);

            // Extract match data from webhook
            const matchData = liveMatchData.data || liveMatchData;
            const matchStatus = matchData.status; // "started", "completed", etc.
            const playStatus = matchData.play_status; // "in_play", "result", etc.
            const matchFormat = matchData.format; // "oneday", "twenty20", "test"
            const play = matchData.play;

            // Process each contest
            for (const contest of contests) {
                await this.evaluateContest(contest, matchStatus, playStatus, matchFormat, play, matchId);
            }
        } catch (error: any) {
            logger.error(`[CONTEST-COMPLETION] Error processing contests for match ${matchId}: ${error.message}`);
            // Don't throw - we don't want to break webhook processing
        }
    }

    /**
     * Get active contests from contest service
     */
    private async getActiveContests(matchId: string): Promise<any[]> {
        try {

            const matchData = await this.matchRepository.getMatchWithId(matchId);
            const id = matchData?.id;
            const response = await axios.get(
                `${this.contestServiceUrl}/api/v1/contests/internal/active/${id}`,
                { timeout: 5000 }
            );
            return response.data?.data || [];
        } catch (error: any) {
            logger.error(`[CONTEST-COMPLETION] Error fetching contests: ${error.message}`);
            return [];
        }
    }

    /**
     * Evaluate if a contest should be completed based on match state
     */
    private async evaluateContest(
        contest: any,
        matchStatus: string,
        playStatus: string,
        matchFormat: string,
        play: any,
        matchId: string
    ): Promise<void> {
        try {
            const contestType = contest.type?.toLowerCase() || contest.timeCommitment?.toLowerCase() || "";
            let shouldComplete = false;
            let reason = "";

            // Powerplay contests: Complete when match starts
            if (contestType.includes("powerplay")) {
                if (matchStatus === "started" || playStatus === "in_play") {
                    shouldComplete = true;
                    reason = "Powerplay contest completed at match start";
                }
            }

            // Middle overs contests: Complete when powerplay ends (after 6 overs)
            else if (contestType.includes("middle_overs") || contestType.includes("middle")) {
                if (matchStatus === "started" && play?.live) {
                    const currentOvers = play.live.score?.overs?.[0] || 0;

                    // Middle overs start after powerplay (6 overs)
                    if (currentOvers >= 6) {
                        shouldComplete = true;
                        reason = `Middle overs contest completed at ${currentOvers} overs`;
                    }
                }
            }

            // Death overs contests: Complete when death overs start
            else if (contestType.includes("death_overs") || contestType.includes("death")) {
                if (matchStatus === "started" && play?.live) {
                    const currentOvers = play.live.score?.overs?.[0] || 0;

                    // Death overs: 40+ for ODI, 16+ for T20
                    const deathOversStart = matchFormat === "twenty20" ? 16 : 40;

                    if (currentOvers >= deathOversStart) {
                        shouldComplete = true;
                        reason = `Death overs contest completed at ${currentOvers} overs (${matchFormat})`;
                    }
                }
            }

            // First innings contests: Complete when first innings starts
            else if (
                contestType.includes("first_innings") ||
                contestType.includes("innings_1") ||
                contestType.includes("1st_innings") ||
                contestType.includes("innings1")
            ) {
                if (matchStatus === "started" && play?.live?.innings) {
                    shouldComplete = true;
                    reason = `First innings contest completed at innings start`;
                }
            }

            // Second innings contests: Complete when second innings starts
            else if (
                contestType.includes("second_innings") ||
                contestType.includes("innings_2") ||
                contestType.includes("2nd_innings") ||
                contestType.includes("innings2")
            ) {
                if (matchStatus === "started" && play?.innings) {
                    const inningsKeys = Object.keys(play.innings);

                    // Check if second innings has started
                    const secondInningsStarted = inningsKeys.some(key => key.endsWith("_2")) ||
                        (inningsKeys.length > 1 && play.live?.innings?.endsWith("_1") === false);

                    if (secondInningsStarted) {
                        shouldComplete = true;
                        reason = `Second innings contest completed at second innings start`;
                    }
                }
            }

            // Session-based contests (for test matches)
            else if (contestType.includes("session")) {
                if (play?.live?.session && matchStatus === "started") {
                    shouldComplete = true;
                    reason = `Session contest completed at session start`;
                }
            }

            // Day-based contests (for test matches)
            else if (contestType.match(/day\d/) || contestType.includes("day1") || contestType.includes("day2")) {
                if (play?.day_number && matchStatus === "started") {
                    shouldComplete = true;
                    reason = `Day contest completed at day ${play.day_number} start`;
                }
            }

            // Full match contests: Complete when match ends
            else if (contestType.includes("full_match") || contestType.includes("fullmatch")) {
                if (matchStatus === "completed" || playStatus === "result") {
                    shouldComplete = true;
                    reason = "Full match contest completed (match ended)";
                }
            }

            // If contest should be completed, update it
            if (shouldComplete) {
                await this.completeContest(contest.id, reason, matchId);
            }
        } catch (error: any) {
            logger.error(`[CONTEST-COMPLETION] Error evaluating contest ${contest.id}: ${error.message}`);
        }
    }

    /**
     * Mark contest as completed in contest service
     */
    private async completeContest(contestId: string, reason: string, matchId: string): Promise<void> {
        try {
            await axios.patch(
                `${this.contestServiceUrl}/api/v1/contests/${contestId}`,
                { status: "completed" },
                { timeout: 5000 }
            );

            logger.info(`[CONTEST-COMPLETION] ✅ Contest ${contestId} completed for match ${matchId}. Reason: ${reason}`);
        } catch (error: any) {
            logger.error(`[CONTEST-COMPLETION] Failed to complete contest ${contestId}: ${error.message}`);
        }
    }
}

export default new ContestCompletionService();
