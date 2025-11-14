// src/services/contest.service.ts
import { ServerError } from "@repo/common";
import { Op } from "sequelize";
import { autoInjectable } from "tsyringe";
import { DB } from "../configs/database.config";
import { TransactionType } from "../dtos/wallet.dto";
import WalletRepository from "../repositories/wallet.repository";

@autoInjectable()
export default class ContestService {
  constructor(private readonly repo: WalletRepository) {
  }

  public async getAllUserWallet() {
    try {
      const walletInfo = await this.repo.getAllWallets();
      return walletInfo;
    } catch (error: any) {
      throw new ServerError(`Error fetching wallet data: ${error.message}`);
    }
  }

  public async showBalance(userId: string) {
    try {
      const walletInfo = await this.repo.getWallet(userId);
      return walletInfo;
    } catch (error: any) {
      throw new ServerError(`Error fetching wallet data: ${error.message}`);
    }
  }

  public async debitBalance(userId: string, amount: number, type:TransactionType) {
    try {
      const transactionInfo = await this.repo.withdrawCoins(userId, amount,type);
      return transactionInfo;
    } catch (error: any) {
      // Re-throw the error as-is to preserve the error type and message
      throw error;
    }
  }

  public async getUserById(userId: string) {
    try {
      const walletInfo = await this.repo.getUserById(userId);
      return walletInfo;
    }
    catch (error: any) {
      throw new ServerError(`Error fetching wallet data: ${error.message}`);
    }
  }
  public async creditBalance(userId: string, amount: number,type:TransactionType) {
    try {
      const transactionInfo = await this.repo.depositCoins(userId, amount,type);
      return transactionInfo;
    } catch (error: any) {
      // Re-throw the error as-is to preserve the error type and message
      throw error;
    }
  }

  public async getUserTransactions(userId: string) {
    try {
      const walletInfo = await this.repo.getTransactions(userId);
      return walletInfo;
    } catch (error: any) {
      throw new ServerError(`Error fetching wallet data: ${error.message}`);
    }
  }

  public async getUserWalletHistory(userId: string) {
    try {
      const walletHistory = await this.repo.getWalletHistory(userId);
      return walletHistory;
    } catch (error: any) {
      throw new ServerError(`Error fetching wallet history: ${error.message}`);
    }
  }

  /**
   * Get wallet and transaction statistics for analytics dashboard
   */
  public async getWalletStats() {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);

      const [
        totalBalance,
        totalDeposited,
        totalWithdrawn,
        totalWinnings,
        activeWallets,
        todayTransactions,
        weekTransactions,
        monthTransactions,
        todayVolume,
        weekVolume,
        monthVolume,
      ] = await Promise.all([
        DB.Wallet.sum("balance"),
        DB.Wallet.sum("totalDeposited"),
        DB.Wallet.sum("totalWithdrawn"),
        DB.Wallet.sum("totalWinnings"),
        DB.Wallet.count({
          where: {
            balance: { [Op.gt]: 0 },
          },
        }),
        DB.Transaction.count({
          where: {
            createdAt: { [Op.gte]: todayStart },
          },
        }),
        DB.Transaction.count({
          where: {
            createdAt: { [Op.gte]: weekAgo },
          },
        }),
        DB.Transaction.count({
          where: {
            createdAt: { [Op.gte]: monthAgo },
          },
        }),
        DB.Transaction.sum("amount", {
          where: {
            createdAt: { [Op.gte]: todayStart },
          },
        }),
        DB.Transaction.sum("amount", {
          where: {
            createdAt: { [Op.gte]: weekAgo },
          },
        }),
        DB.Transaction.sum("amount", {
          where: {
            createdAt: { [Op.gte]: monthAgo },
          },
        }),
      ]);

      return {
        wallets: {
          totalBalance: totalBalance || 0,
          totalDeposits: totalDeposited || 0,
          totalWithdrawals: totalWithdrawn || 0,
          totalWinnings: totalWinnings || 0,
          activeWallets: activeWallets || 0,
        },
        transactions: {
          totalToday: todayTransactions || 0,
          totalThisWeek: weekTransactions || 0,
          totalThisMonth: monthTransactions || 0,
          volumeToday: todayVolume || 0,
          volumeThisWeek: weekVolume || 0,
          volumeThisMonth: monthVolume || 0,
        }
      };
    } catch (err: any) {
      throw new ServerError(`Failed to fetch wallet statistics: ${err.message}`);
    }
  }
}
