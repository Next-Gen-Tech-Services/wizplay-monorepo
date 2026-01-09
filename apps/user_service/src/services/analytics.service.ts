import { logger, ServerError } from "@repo/common";
import axios from "axios";
import { autoInjectable } from "tsyringe";
import { DB } from "../configs/database.config";
import ServerConfigs from "../configs/server.config";

interface AnalyticsSummary {
    users: {
        total: number;
        active: number;
        newToday: number;
        newThisWeek: number;
        newThisMonth: number;
        byType: { user: number; admin: number };
    };
    contests: {
        total: number;
        scheduled: number;
        running: number;
        completed: number;
        totalParticipants: number;
    };
    matches: {
        total: number;
        upcoming: number;
        live: number;
        completed: number;
    };
    coupons: {
        total: number;
        active: number;
        redeemed: number;
        expired: number;
        totalValue: number;
    };
    wallets: {
        totalBalance: number;
        totalDeposits: number;
        totalWithdrawals: number;
        totalWinnings: number;
        activeWallets: number;
    };
    transactions: {
        totalToday: number;
        totalThisWeek: number;
        totalThisMonth: number;
        volumeToday: number;
        volumeThisWeek: number;
        volumeThisMonth: number;
    };
    revenue: {
        totalEntryFees: number;
        totalPayouts: number;
        netRevenue: number;
    };
}

@autoInjectable()
export default class AnalyticsService {
    /**
     * Get comprehensive dashboard analytics
     */
    async getDashboardAnalytics(): Promise<AnalyticsSummary> {
        try {
            // Parallel fetch from all services
            const [userStats, contestStats, matchStats, walletStats, couponStats] =
                await Promise.allSettled([
                    this.getUserAnalytics(),
                    this.getContestAnalytics(),
                    this.getMatchAnalytics(),
                    this.getWalletAnalytics(),
                    this.getCouponAnalytics(),
                ]);

            return {
                users:
                    userStats.status === "fulfilled"
                        ? userStats.value
                        : this.getDefaultUserStats(),
                contests:
                    contestStats.status === "fulfilled"
                        ? contestStats.value
                        : this.getDefaultContestStats(),
                matches:
                    matchStats.status === "fulfilled"
                        ? matchStats.value
                        : this.getDefaultMatchStats(),
                coupons:
                    couponStats.status === "fulfilled"
                        ? couponStats.value
                        : this.getDefaultCouponStats(),
                wallets:
                    walletStats.status === "fulfilled"
                        ? walletStats.value.wallets
                        : this.getDefaultWalletStats(),
                transactions:
                    walletStats.status === "fulfilled"
                        ? walletStats.value.transactions
                        : this.getDefaultTransactionStats(),
                revenue:
                    contestStats.status === "fulfilled" && walletStats.status === "fulfilled"
                        ? this.calculateRevenue(contestStats.value, walletStats.value)
                        : this.getDefaultRevenueStats(),
            };
        } catch (error: any) {
            logger.error(`[AnalyticsService] Error fetching analytics: ${error.message}`);
            throw new ServerError("Failed to fetch analytics data");
        }
    }

    /**
     * Get user analytics from user_service database
     */
    private async getUserAnalytics() {
        try {
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

            const weekAgo = new Date(now);
            weekAgo.setDate(weekAgo.getDate() - 7);

            const monthAgo = new Date(now);
            monthAgo.setMonth(monthAgo.getMonth() - 1);

            const [
                total,
                newToday,
                newThisWeek,
                newThisMonth,
                userCount,
                adminCount,
            ] = await Promise.all([
                DB.User.count({
                    where: {
                       
                        type: 'user'
                    },
                }),
                DB.User.count({
                    where: {
                        createdAt: {
                            [DB.Sequelize.Op.gte]: todayStart,
                        },
                        type: 'user'
                    },
                }),
                DB.User.count({
                    where: {
                        createdAt: {
                            [DB.Sequelize.Op.gte]: weekAgo,
                        },
                        type: 'user'

                    },
                }),
                DB.User.count({
                    where: {
                        createdAt: {
                            [DB.Sequelize.Op.gte]: monthAgo,
                        },
                        type: 'user'

                    },


                }),
                DB.User.count({
                    where: {
                        type: "user",
                    },
                }),
                DB.User.count({
                    where: {
                        type: "admin",
                    },
                }),
            ]);

            return {
                total,
                active: total, // Can be refined with last login logic
                newToday,
                newThisWeek,
                newThisMonth,
                byType: {
                    user: userCount,
                    admin: adminCount,
                },
            };
        } catch (error: any) {
            logger.error(`[AnalyticsService] User analytics error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get contest analytics from contest_service
     */
    private async getContestAnalytics() {
        try {
            const contestServiceUrl = ServerConfigs.CONTEST_SERVICE_URL;

            // Try to fetch from contest service API
            try {
                const response = await axios.get(
                    `${contestServiceUrl}/api/v1/contests/stats`,
                    {
                        timeout: 3000,
                        headers: {
                            'X-Internal-Request': 'true'
                        }
                    }
                );

                if (response.data?.success && response.data?.data) {
                    const data = response.data.data;
                    return {
                        total: data.total || 0,
                        scheduled: data.scheduled || 0,
                        running: data.running || 0,
                        completed: data.completed || 0,
                        totalParticipants: data.totalParticipants || 0,
                        totalPrizePool: data.totalPrizePool || 0,
                    };
                }
            } catch (apiError: any) {
                logger.warn(
                    `[AnalyticsService] Contest API unavailable (${contestServiceUrl}): ${apiError.message}`
                );
            }

            // Fallback: Return default stats with message
            logger.info(`[AnalyticsService] Using default contest stats - API endpoint not implemented`);
            return this.getDefaultContestStats();
        } catch (error: any) {
            logger.error(
                `[AnalyticsService] Contest analytics error: ${error.message}`
            );
            return this.getDefaultContestStats();
        }
    }

    /**
     * Get match analytics from match_service
     */
    private async getMatchAnalytics() {
        try {
            const matchServiceUrl = ServerConfigs.MATCHES_SERVICE_URL;

            // Try to fetch from match service API
            try {
                const response = await axios.get(
                    `${matchServiceUrl}/api/v1/matches/stats`,
                    {
                        timeout: 3000,
                        headers: {
                            'X-Internal-Request': 'true'
                        }
                    }
                );

                if (response.data?.success && response.data?.data) {
                    const data = response.data.data;
                    return {
                        total: data.total || 0,
                        upcoming: data.upcoming || 0,
                        live: data.live || 0,
                        completed: data.completed || 0,
                    };
                }
            } catch (apiError: any) {
                logger.warn(
                    `[AnalyticsService] Match API unavailable (${matchServiceUrl}): ${apiError.message}`
                );
            }

            // Fallback: Return default stats
            logger.info(`[AnalyticsService] Using default match stats - API endpoint not implemented`);
            return this.getDefaultMatchStats();
        } catch (error: any) {
            logger.error(`[AnalyticsService] Match analytics error: ${error.message}`);
            return this.getDefaultMatchStats();
        }
    }

    /**
     * Get wallet analytics from wallet_service
     */
    private async getWalletAnalytics() {
        try {
            const walletServiceUrl = ServerConfigs.WALLET_SERVICE_URL;

            // Try to fetch from wallet service API
            try {
                const response = await axios.get(
                    `${walletServiceUrl}/api/v1/wallet/stats`,
                    {
                        timeout: 3000,
                        headers: {
                            'X-Internal-Request': 'true'
                        }
                    }
                );

                if (response.data?.success && response.data?.data) {
                    const data = response.data.data;
                    return {
                        wallets: {
                            totalBalance: data.wallets?.totalBalance || 0,
                            totalDeposits: data.wallets?.totalDeposits || 0,
                            totalWithdrawals: data.wallets?.totalWithdrawals || 0,
                            totalWinnings: data.wallets?.totalWinnings || 0,
                            activeWallets: data.wallets?.activeWallets || 0,
                        },
                        transactions: {
                            totalToday: data.transactions?.totalToday || 0,
                            totalThisWeek: data.transactions?.totalThisWeek || 0,
                            totalThisMonth: data.transactions?.totalThisMonth || 0,
                            volumeToday: data.transactions?.volumeToday || 0,
                            volumeThisWeek: data.transactions?.volumeThisWeek || 0,
                            volumeThisMonth: data.transactions?.volumeThisMonth || 0,
                        }
                    };
                }
            } catch (apiError: any) {
                logger.warn(
                    `[AnalyticsService] Wallet API unavailable (${walletServiceUrl}): ${apiError.message}`
                );
            }

            // Fallback: Return default stats
            logger.info(`[AnalyticsService] Using default wallet stats - API endpoint not implemented`);
            return {
                wallets: this.getDefaultWalletStats(),
                transactions: this.getDefaultTransactionStats(),
            };
        } catch (error: any) {
            logger.error(
                `[AnalyticsService] Wallet analytics error: ${error.message}`
            );
            return {
                wallets: this.getDefaultWalletStats(),
                transactions: this.getDefaultTransactionStats(),
            };
        }
    }

    /**
     * Get coupon analytics from coupon_service
     */
    private async getCouponAnalytics() {
        try {
            const couponServiceUrl = ServerConfigs.COUPON_SERVICE_URL;
            
            if (!couponServiceUrl) {
                logger.info(`[AnalyticsService] Coupon service URL not configured, using defaults`);
                return this.getDefaultCouponStats();
            }

            // Try to fetch from coupon service API
            try {
                const response = await axios.get(`${couponServiceUrl}/api/v1/coupons/stats`);

                logger.info(`[AnalyticsService] Coupon service response status: ${response.status}`);
                if (response.status === 200 && response.data?.success && response.data?.data) {
                    return response.data.data;
                }
                
                if (response.status === 400) {
                    logger.warn(`[AnalyticsService] Coupon service returned 400 - possibly missing database tables or invalid request`);
                } else if (response.status === 404) {
                    logger.warn(`[AnalyticsService] Coupon stats endpoint not found - using defaults`);
                } else {
                    logger.warn(`[AnalyticsService] Coupon service returned status ${response.status}`);
                }
                
            } catch (apiError: any) {
                if (apiError.code === 'ECONNREFUSED') {
                    logger.warn(`[AnalyticsService] Coupon service not available (connection refused)`);
                } else {
                    logger.warn(`[AnalyticsService] Coupon service API failed: ${apiError.message}`);
                }
            }

            logger.info(`[AnalyticsService] Using default coupon stats - API endpoint not ready`);
            return this.getDefaultCouponStats();
        } catch (error: any) {
            logger.error(
                `[AnalyticsService] Coupon analytics error: ${error.message}`
            );
            return this.getDefaultCouponStats();
        }
    }

    /**
     * Calculate revenue metrics
     */
    private calculateRevenue(contestStats: any, walletStats: any) {
        // Use actual wallet transaction data for accurate revenue calculation
        const totalEntryFees = walletStats?.transactions?.volumeThisMonth || 0; // Total transaction volume as entry fees
        const totalPayouts = walletStats?.wallets?.totalWinnings || 0; // Actual winnings paid out
        const netRevenue = totalEntryFees - totalPayouts;

        return {
            totalEntryFees,
            totalPayouts,
            netRevenue,
        };
    }

    // Default stats for fallback
    private getDefaultUserStats() {
        return {
            total: 0,
            active: 0,
            newToday: 0,
            newThisWeek: 0,
            newThisMonth: 0,
            byType: { user: 0, admin: 0 },
        };
    }

    private getDefaultContestStats() {
        return {
            total: 0,
            scheduled: 0,
            running: 0,
            completed: 0,
            totalParticipants: 0,
            totalPrizePool: 0,
        };
    }

    private getDefaultMatchStats() {
        return {
            total: 0,
            upcoming: 0,
            live: 0,
            completed: 0,
        };
    }

    private getDefaultWalletStats() {
        return {
            totalBalance: 0,
            totalDeposits: 0,
            totalWithdrawals: 0,
            totalWinnings: 0,
            activeWallets: 0,
        };
    }

    private getDefaultTransactionStats() {
        return {
            totalToday: 0,
            totalThisWeek: 0,
            totalThisMonth: 0,
            volumeToday: 0,
            volumeThisWeek: 0,
            volumeThisMonth: 0,
        };
    }

    private getDefaultRevenueStats() {
        return {
            totalEntryFees: 0,
            totalPayouts: 0,
            netRevenue: 0,
        };
    }

    private getDefaultCouponStats() {
        return {
            total: 0,
            active: 0,
            redeemed: 0,
            expired: 0,
            totalValue: 0,
        };
    }
}
