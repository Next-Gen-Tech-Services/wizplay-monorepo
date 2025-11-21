// src/repositories/leaderboard.repository.ts
import { logger } from "@repo/common";
import { Op, QueryTypes } from "sequelize";
import axios from "axios";
import { DB } from "../configs/database.config";
import ServerConfigs from "../configs/server.config";
import { LeaderboardEntry, UserRankResponse } from "../dtos/leaderboard.dto";

export default class LeaderboardRepository {
  private _DB = DB;

  constructor() {}

  /**
   * Fetch user data from user service
   * @private
   */
  private async fetchUsersData(userIds: string[]): Promise<Map<string, any>> {
    const userMap = new Map<string, any>();
    
    if (userIds.length === 0) return userMap;

    try {
      // Limit concurrent requests to avoid overloading user service
      const concurrentLimit = 10;
      const timeout = 3000; // 3 seconds timeout per request
      
      // Process in batches
      for (let i = 0; i < userIds.length; i += concurrentLimit) {
        const batch = userIds.slice(i, i + concurrentLimit);
        
        const userPromises = batch.map(async (userId) => {
          try {
            const response = await axios.get(
              `${ServerConfigs.USER_SERVICE_URL}/api/v1/user/${userId}`,
              { 
                timeout,
                validateStatus: (status) => status < 500 // Don't throw on 4xx
              }
            );

            if (response.data?.success && response.data.data) {
              const user = response.data.data;
              return {
                userId,
                userData: {
                  userName: user.name || user.userName ,
                  userEmail: user.email || null,
                }
              };
            }
          } catch (userErr: any) {
            logger.debug(`Failed to fetch user ${userId}: ${userErr?.message}`);
          }
          return null;
        });

        const results = await Promise.allSettled(userPromises);
        
        results.forEach((result) => {
          if (result.status === 'fulfilled' && result.value) {
            userMap.set(result.value.userId, result.value.userData);
          }
        });
      }

      logger.info(`Fetched ${userMap.size} users out of ${userIds.length} requested`);
    } catch (err: any) {
      logger.error(`Error fetching user data: ${err?.message ?? err}`);
    }

    return userMap;
  }

  /**
   * Get contest leaderboard with rankings
   * Efficiently fetch and rank all submissions for a contest
   */
  public async getContestLeaderboard(
    contestId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ entries: LeaderboardEntry[]; totalCount: number }> {
    try {
      // Get all submissions for the contest, ordered by score DESC
      const submissions = await this._DB.UserSubmission.findAll({
        where: { contestId },
        attributes: ["userId", "contestId", "totalScore", "maxScore", "createdAt"],
        order: [
          ["totalScore", "DESC"],
          ["createdAt", "ASC"], // Tiebreaker: earlier submission wins
        ],
        raw: true,
      });

      const totalCount = submissions.length;

      // Get the paginated slice
      const paginatedSubmissions = submissions.slice(offset, offset + limit);

      // Extract unique user IDs from paginated results
      const userIds = [...new Set(paginatedSubmissions.map((sub: any) => sub.userId))];

      // Fetch user data
      const usersMap = await this.fetchUsersData(userIds);

      // Calculate rankings and percentages with user data
      const entries: LeaderboardEntry[] = paginatedSubmissions
        .map((sub: any, index: number) => {
          const userData = usersMap.get(sub.userId);
          return {
            rank: offset + index + 1,
            userId: sub.userId,
            userName: userData?.userName,
            email: userData?.email ,
            contestId: sub.contestId,
            totalScore: sub.totalScore,
            maxScore: sub.maxScore,
            percentage: sub.maxScore > 0 ? Math.round((sub.totalScore / sub.maxScore) * 100) : 0,
            submittedAt: sub.createdAt,
          };
        });

      return { entries, totalCount };
    } catch (err: any) {
      logger.error(
        `LeaderboardRepository.getContestLeaderboard error: ${err?.message ?? err}`
      );
      throw err;
    }
  }

  /**
   * Get a specific user's rank in a contest
   */
  public async getUserRankInContest(
    userId: string,
    contestId: string
  ): Promise<UserRankResponse | null> {
    try {
      // Get user's submission
      const userSubmission = await this._DB.UserSubmission.findOne({
        where: { userId, contestId },
        attributes: ["totalScore", "maxScore", "createdAt"],
        raw: true,
      });

      if (!userSubmission) {
        return null;
      }

      // Count how many users scored higher (or same but submitted later)
      const higherRankedCount = await this._DB.UserSubmission.count({
        where: {
          contestId,
          [Op.or]: [
            { totalScore: { [Op.gt]: userSubmission.totalScore } },
            {
              totalScore: userSubmission.totalScore,
              createdAt: { [Op.lt]: userSubmission.createdAt },
            },
          ],
        },
      });

      const rank = higherRankedCount + 1;

      // Get total participants
      const totalParticipants = await this._DB.UserSubmission.count({
        where: { contestId },
      });

      const percentage =
        userSubmission.maxScore > 0
          ? Math.round((userSubmission.totalScore / userSubmission.maxScore) * 100)
          : 0;

      const percentile =
        totalParticipants > 0
          ? Math.round(((totalParticipants - rank + 1) / totalParticipants) * 100)
          : 0;

      return {
        userId,
        contestId,
        rank,
        totalScore: userSubmission.totalScore,
        maxScore: userSubmission.maxScore,
        percentage,
        totalParticipants,
        percentile,
      };
    } catch (err: any) {
      logger.error(
        `LeaderboardRepository.getUserRankInContest error: ${err?.message ?? err}`
      );
      throw err;
    }
  }

  /**
   * Get leaderboard for all contests in a match
   */
  public async getMatchLeaderboards(
    matchId: string,
    topN: number = 10
  ): Promise<any[]> {
    try {
      // Find all contests for this match
      const contests = await this._DB.Contest.findAll({
        where: { matchId },
        attributes: ["id", "title"],
        raw: true,
      });

      if (contests.length === 0) {
        return [];
      }

      const contestIds = contests.map((c: any) => c.id);

      // Get top performers for each contest
      const result = [];
      for (const contest of contests) {
        const { entries } = await this.getContestLeaderboard(
          (contest as any).id,
          topN,
          0
        );

        result.push({
          contestId: (contest as any).id,
          contestTitle: (contest as any).title,
          topPerformers: entries,
        });
      }

      return result;
    } catch (err: any) {
      logger.error(
        `LeaderboardRepository.getMatchLeaderboards error: ${err?.message ?? err}`
      );
      throw err;
    }
  }

  /**
   * Get user's performance across all contests (global leaderboard)
   */
  public async getUserGlobalStats(userId: string): Promise<any> {
    try {
      const submissions = await this._DB.UserSubmission.findAll({
        where: { userId },
        attributes: ["totalScore", "maxScore", "contestId"],
        raw: true,
      });

      if (submissions.length === 0) {
        return {
          userId,
          totalContestsPlayed: 0,
          totalScore: 0,
          averageScore: 0,
          averagePercentage: 0,
          topRanks: [],
        };
      }

      const totalScore = submissions.reduce(
        (sum: number, sub: any) => sum + sub.totalScore,
        0
      );
      const totalMaxScore = submissions.reduce(
        (sum: number, sub: any) => sum + sub.maxScore,
        0
      );
      const averageScore = Math.round(totalScore / submissions.length);
      const averagePercentage =
        totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;

      // Get user's ranks in each contest
      const topRanks = [];
      for (const sub of submissions.slice(0, 10)) {
        // Limit to 10 for performance
        const rank = await this.getUserRankInContest(
          userId,
          (sub as any).contestId
        );
        if (rank) {
          topRanks.push(rank);
        }
      }

      return {
        userId,
        totalContestsPlayed: submissions.length,
        totalScore,
        averageScore,
        averagePercentage,
        topRanks: topRanks.sort((a, b) => a.rank - b.rank).slice(0, 5), // Top 5 ranks
      };
    } catch (err: any) {
      logger.error(
        `LeaderboardRepository.getUserGlobalStats error: ${err?.message ?? err}`
      );
      throw err;
    }
  }

  /**
   * Get global leaderboard across all contests
   * Ranked by total score or average score
   */
  public async getGlobalLeaderboard(
    limit: number = 50,
    offset: number = 0,
    sortBy: "total" | "average" = "total"
  ): Promise<any[]> {
    try {
      // Use raw SQL for efficiency with aggregation
      const query = `
        SELECT 
          user_id,
          COUNT(*) as contests_played,
          SUM(total_score) as total_score,
          AVG(total_score) as average_score,
          SUM(total_score) / NULLIF(SUM(max_score), 0) * 100 as average_percentage
        FROM user_submissions
        GROUP BY user_id
        ORDER BY ${sortBy === "total" ? "total_score" : "average_score"} DESC
        LIMIT :limit OFFSET :offset
      `;

      const results = await this._DB.sequelize.query(query, {
        replacements: { limit, offset },
        type: QueryTypes.SELECT,
      });

      // Extract user IDs
      const userIds = results.map((row: any) => row.user_id);

      // Fetch user data
      const usersMap = await this.fetchUsersData(userIds);

      return results.map((row: any, index: number) => {
        const userData = usersMap.get(row.user_id);
        return {
          rank: offset + index + 1,
          userId: row.user_id,
          userName: userData?.userName || "Unknown User",
          userAvatar: userData?.userAvatar || null,
          totalContestsPlayed: parseInt(row.contests_played),
          totalScore: parseInt(row.total_score),
          averageScore: Math.round(parseFloat(row.average_score)),
          averagePercentage: Math.round(parseFloat(row.average_percentage) || 0),
        };
      });
    } catch (err: any) {
      logger.error(
        `LeaderboardRepository.getGlobalLeaderboard error: ${err?.message ?? err}`
      );
      throw err;
    }
  }

  /**
   * Get top performers for a specific date range
   */
  public async getLeaderboardByDateRange(
    startDate: Date,
    endDate: Date,
    limit: number = 50
  ): Promise<any[]> {
    try {
      const query = `
        SELECT 
          user_id,
          COUNT(*) as contests_played,
          SUM(total_score) as total_score,
          AVG(total_score) as average_score
        FROM user_submissions
        WHERE created_at BETWEEN :startDate AND :endDate
        GROUP BY user_id
        ORDER BY total_score DESC
        LIMIT :limit
      `;

      const results = await this._DB.sequelize.query(query, {
        replacements: { startDate, endDate, limit },
        type: QueryTypes.SELECT,
      });

      // Extract user IDs
      const userIds = results.map((row: any) => row.user_id);

      // Fetch user data
      const usersMap = await this.fetchUsersData(userIds);

      return results.map((row: any, index: number) => {
        const userData = usersMap.get(row.user_id);
        return {
          rank: index + 1,
          userId: row.user_id,
          userName: userData?.userName || "Unknown User",
          userAvatar: userData?.userAvatar || null,
          contestsPlayed: parseInt(row.contests_played),
          totalScore: parseInt(row.total_score),
          averageScore: Math.round(parseFloat(row.average_score)),
        };
      });
    } catch (err: any) {
      logger.error(
        `LeaderboardRepository.getLeaderboardByDateRange error: ${err?.message ?? err}`
      );
      throw err;
    }
  }

  /**
   * Get user's detailed leaderboard history with performance stats
   * Returns recent contest entries and calculated performance metrics
   */
  public async getUserLeaderboardHistory(
    userId: string,
    limit: number = 10
  ): Promise<any> {
    try {
      // Get user's submissions with full contest details
      const submissions = await this._DB.UserSubmission.findAll({
        where: { userId },
        attributes: ["contestId", "totalScore", "maxScore", "createdAt"],
        include: [
          {
            model: this._DB.Contest,
            as: "contest",
            attributes: [
              "id",
              "matchId",
              "title",
              "description",
              "type",
              "difficulty",
              "startAt",
              "endAt",
              "entryFee",
              "prizePool",
              "prizeBreakdown",
              "pointsPerQuestion",
              "questionsCount",
              "totalSpots",
              "filledSpots",
              "displayEnabled",
              "isPopular",
              "joinDeadline",
              "resultTime",
              "timeCommitment",
              "platform",
              "status",
              "createdAt",
              "updatedAt",
            ],
          },
        ],
        order: [["createdAt", "DESC"]],
        limit: limit * 2, // Get more to calculate stats, then limit for recent entries
      });

      if (submissions.length === 0) {
        return {
          recentEntries: [],
          stats: {
            totalContests: 0,
            averageRank: 0,
            bestRank: 0,
            top10Finishes: 0,
            top3Finishes: 0,
            totalScore: 0,
            winRate: 0,
            percentile: 0,
          },
        };
      }

      // Fetch full match data for contests with matchId
      const matchIds = [
        ...new Set(
          submissions
            .map((s: any) => s.contest?.matchId)
            .filter((id: any) => id)
        ),
      ];

      const matchesMap = new Map<string, any>();
      for (const matchId of matchIds) {
        try {
          const response = await axios.get(
            `${ServerConfigs.MATCHES_SERVICE_URL}/api/v1/matches/${matchId}`,
            { timeout: 3000 }
          );
          if (response.data?.success && response.data.data) {
            const match = response.data.data;
            matchesMap.set(matchId, match);
          }
        } catch (err: any) {
          logger.debug(`Failed to fetch match ${matchId}: ${err?.message}`);
        }
      }

      // Calculate rank for each submission
      const entriesWithRank = await Promise.all(
        submissions.map(async (submission: any) => {
          const rankData = await this.getUserRankInContest(
            userId,
            submission.contestId
          );

          const matchId = submission.contest?.matchId;
          const matchData = matchId ? matchesMap.get(matchId) : null;
          
          // Extract team names for matchInfo
          let matchInfo = "Unknown Match";
          if (matchData?.teams?.a?.name && matchData?.teams?.b?.name) {
            matchInfo = `${matchData.teams.a.name} vs ${matchData.teams.b.name}`;
          } else if (matchData?.teamA && matchData?.teamB) {
            const teamA = matchData.teamA?.name || matchData.teamA || "Team A";
            const teamB = matchData.teamB?.name || matchData.teamB || "Team B";
            matchInfo = `${teamA} vs ${teamB}`;
          }

          // Serialize contest data
          const contestData = submission.contest?.toJSON ? submission.contest.toJSON() : submission.contest;

          return {
            contestId: submission.contestId,
            contestName: submission.contest?.title || "Unknown Contest",
            matchInfo,
            rank: rankData?.rank || 0,
            totalParticipants: rankData?.totalParticipants || 0,
            score: submission.totalScore,
            date: submission.createdAt,
            // Include full contest and match data
            contest: contestData,
            matchData: matchData,
          };
        })
      );

      // Calculate performance stats
      const totalContests = entriesWithRank.length;
      const validRanks = entriesWithRank.filter((e) => e.rank > 0);
      
      const averageRank =
        validRanks.length > 0
          ? validRanks.reduce((sum, e) => sum + e.rank, 0) / validRanks.length
          : 0;
      
      const bestRank = 
        validRanks.length > 0
          ? Math.min(...validRanks.map((e) => e.rank))
          : 0;
      
      const top10Finishes = validRanks.filter((e) => e.rank <= 10).length;
      const top3Finishes = validRanks.filter((e) => e.rank <= 3).length;
      
      const totalScore = entriesWithRank.reduce((sum, e) => sum + e.score, 0);
      
      const winRate =
        validRanks.length > 0 ? (top3Finishes / validRanks.length) * 100 : 0;

      // Calculate percentile (average position across all contests)
      const percentileValues = validRanks
        .filter((e) => e.totalParticipants > 0)
        .map(
          (e) =>
            ((e.totalParticipants - e.rank) / e.totalParticipants) * 100
        );
      
      const percentile =
        percentileValues.length > 0
          ? percentileValues.reduce((sum, val) => sum + val, 0) /
            percentileValues.length
          : 0;

      return {
        recentEntries: entriesWithRank.slice(0, limit),
        stats: {
          totalContests,
          averageRank: Math.round(averageRank * 10) / 10,
          bestRank,
          top10Finishes,
          top3Finishes,
          totalScore,
          winRate: Math.round(winRate * 10) / 10,
          percentile: Math.round(percentile),
        },
      };
    } catch (err: any) {
      logger.error(
        `LeaderboardRepository.getUserLeaderboardHistory error: ${err?.message ?? err}`
      );
      throw err;
    }
  }
}
