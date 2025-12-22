// src/repositories/contest.repository.ts
import { Wallet } from "@/models/wallet.model";
import { BadRequestError, logger, ServerError, NotificationHelper } from "@repo/common";
import { DB, IDatabase } from "../configs/database.config";
import ServerConfigs from "../configs/server.config";
import { TransactionType } from "../dtos/wallet.dto";
import axios from "axios";

export default class WalletRepository {
  private _DB: IDatabase = DB;
  private notificationHelper: NotificationHelper;

  constructor() {
    this._DB = DB;
    this.notificationHelper = new NotificationHelper(ServerConfigs.NOTIFICATION_SERVICE_URL);
  }

  public async getAllWallets(): Promise<any> {
    try {
      const walletInfo = await this._DB.Wallet.findAll();
      return walletInfo.map((wallet) => wallet.toJSON()) as Wallet[];
    } catch (err: any) {
      logger.error(`DB error: ${err?.message ?? err}`);
      throw new ServerError(err.message);
    }
  }

  public async createWallet(userId: string, authId: string): Promise<any> {
    try {
      const newWallet = await this._DB.Wallet.create({
        userId,
        balance: 100,
        depositAmount: 100, // Joining bonus goes to deposit amount
        winningAmount: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        totalWinnings: 0,
        totalReferralEarnings: 0,
        currency: "wizcoin",
        status: "active",
      });

      // retry needs to be implemented
      if (!newWallet) {
        throw new BadRequestError("error while initilizing wallet");
      }

      logger.info(`Wallet created for userId: ${newWallet.id} `);
      // Create initial transaction
      await this._DB.Transaction.create({
        walletId: newWallet.id,
        type: "joining_bonus",
        userId: userId,
        amount: 100,
        balanceBefore: 0,
        balanceAfter: 100,
      });

      // Send welcome notification for joining bonus
      await this.notificationHelper.sendWalletNotification(
        userId, 
        'deposit', 
        100, 
        100,
        'joining_bonus'
      );

      return newWallet;
    } catch (err: any) {
      logger.error(`DB error: ${err?.message ?? err}`);
      throw new ServerError(err.message);
    }
  }

  public async getWallet(userId: string): Promise<any> {
    try {
      const walletInfo = await this._DB.Wallet.findOne({
        where: {
          userId: userId,
        },
      });

      if (!walletInfo) {
        throw new BadRequestError("No wallet found for this user");
      }
      return walletInfo.toJSON() as Wallet;
    } catch (err: any) {
      logger.error(`DB error: ${err?.message ?? err}`);
      throw new ServerError(err.message);
    }
  }

  public async withdrawCoins(userId: string, amount: number, type: TransactionType, referenceId?: string, referenceType?: string): Promise<any> {
    try {
      const walletInfo = await this._DB.Wallet.findOne({
        where: {
          userId,
        },
      });

      if (!walletInfo) {
        throw new BadRequestError("Wallet not found for this user");
      }

      if (walletInfo.balance < amount) {
        throw new BadRequestError("Insufficient wallet balance");
      }

      // For contest_entry, use deposit first, then winning amount
      let deductFromDeposit = 0;
      let deductFromWinning = 0;

      if (type === "contest_entry") {
        // Try to deduct from deposit first
        if (walletInfo.depositAmount >= amount) {
          deductFromDeposit = amount;
        } else {
          // Use all available deposit, then take from winning
          deductFromDeposit = walletInfo.depositAmount;
          deductFromWinning = amount - walletInfo.depositAmount;
          
          // Check if we have enough in winning amount
          if (walletInfo.winningAmount < deductFromWinning) {
            throw new BadRequestError("Insufficient wallet balance");
          }
        }
      } else {
        // For other transactions (withdrawal, etc.), deduct from total balance proportionally
        const totalBalance = walletInfo.depositAmount + walletInfo.winningAmount;
        if (totalBalance > 0) {
          const depositRatio = walletInfo.depositAmount / totalBalance;
          deductFromDeposit = Math.min(Math.floor(amount * depositRatio), walletInfo.depositAmount);
          deductFromWinning = amount - deductFromDeposit;
        }
      }

      const walletPayload = {
        balance: walletInfo.balance - Number(amount),
        depositAmount: walletInfo.depositAmount - deductFromDeposit,
        winningAmount: walletInfo.winningAmount - deductFromWinning,
        totalWithdrawn: walletInfo.totalWithdrawn + Number(amount),
      };

      const updatedWalletInfo = await this._DB.Wallet.update(walletPayload, {
        where: {
          userId,
        },
        returning: true,
      });

      let createTransaction;
      if (updatedWalletInfo[0]) {
        createTransaction = await this._DB.Transaction.create({
          walletId: walletInfo.id,
          type: type,
          userId: userId,
          amount: amount,
          balanceBefore: walletInfo.balance,
          balanceAfter: updatedWalletInfo[1][0].balance,
          referenceId: referenceId || null,
          referenceType: referenceType || null,
        });

        // Send notification for withdrawal
        await this.notificationHelper.sendWalletNotification(
          userId, 
          'withdrawal', 
          amount, 
          updatedWalletInfo[1][0].balance,
          type
        );
      }

      return {
        wallet: updatedWalletInfo[1][0],
        transaction: createTransaction,
      };
    } catch (err: any) {
      // Re-throw BadRequestError as-is to preserve the specific error message
      if (err instanceof BadRequestError) {
        throw err;
      }
      logger.error(`DB error in withdrawCoins: ${err?.message ?? err}`);
      throw new ServerError(err.message);
    }
  }

  public async depositCoins(userId: string, amount: number, type: TransactionType, referenceId?: string, referenceType?: string): Promise<any> {
    try {
      const walletInfo = await this._DB.Wallet.findOne({
        where: {
          userId,
        },
      });

      if (!walletInfo) {
        throw new BadRequestError("Wallet not found for this user");
      }

      let walletPayload: {
        balance: number;
        depositAmount?: number;
        winningAmount?: number;
        totalReferralEarnings?: number;
        totalWinnings?: number;
        totalDeposited?: number;
      } = {
        balance: walletInfo.balance + Number(amount),
      };

      // Determine which balance to credit based on transaction type
      if (type === "deposit") {
        // Regular deposits go to depositAmount
        walletPayload["depositAmount"] = walletInfo.depositAmount + Number(amount);
        walletPayload["totalDeposited"] = walletInfo.totalDeposited + Number(amount);
      } else if (type === "referral_bonus" || type === "referral") {
        // Referral earnings go to depositAmount (with deposits)
        walletPayload["depositAmount"] = walletInfo.depositAmount + Number(amount);
        walletPayload["totalReferralEarnings"] = walletInfo.totalReferralEarnings + Number(amount);
      } else if (type === "contest_winnings") {
        // Contest winnings go to winningAmount
        walletPayload["winningAmount"] = walletInfo.winningAmount + Number(amount);
        walletPayload["totalWinnings"] = walletInfo.totalWinnings + Number(amount);
      } else if (type === "joining_bonus" || type === "bonus") {
        // Bonuses go to depositAmount (like referrals)
        walletPayload["depositAmount"] = walletInfo.depositAmount + Number(amount);
      } else if (type === "contest_refund") {
        // Refunds restore to the original balance proportionally
        // For simplicity, add to depositAmount as it was likely deducted from there first
        walletPayload["depositAmount"] = walletInfo.depositAmount + Number(amount);
      } else {
        // Default: add to depositAmount for safety
        walletPayload["depositAmount"] = walletInfo.depositAmount + Number(amount);
      }

      const updatedWalletInfo = await this._DB.Wallet.update(walletPayload, {
        where: {
          userId,
        },
        returning: true,
      });

      let createTransaction;
      if (updatedWalletInfo[0]) {
        createTransaction = await this._DB.Transaction.create({
          walletId: walletInfo.id,
          type: type,
          userId: userId,
          amount: amount,
          balanceBefore: walletInfo.balance,
          balanceAfter: updatedWalletInfo[1][0].balance,
          referenceId: referenceId || null,
          referenceType: referenceType || null,
        });

        // Send notification for deposit
        await this.notificationHelper.sendWalletNotification(
          userId, 
          'deposit', 
          amount, 
          updatedWalletInfo[1][0].balance,
          type
        );
      }

      return {
        wallet: updatedWalletInfo[1][0],
        transaction: createTransaction,
      };
    } catch (err: any) {
      // Re-throw BadRequestError as-is to preserve the specific error message
      if (err instanceof BadRequestError) {
        throw err;
      }
      logger.error(`DB error in depositCoins: ${err?.message ?? err}`);
      throw new ServerError(err.message);
    }
  }

  public async getUserById(userId: string): Promise<any> {
    try {
      const userWallet = await this._DB.Wallet.findOne({
        where: {
          userId: userId,
        },
      });
      
      if (!userWallet) {
        throw new BadRequestError("No wallet found for this user");
      }
      return userWallet.toJSON() as Wallet;
    }
    catch (err: any) {
      logger.error(`DB error: ${err?.message ?? err}`);
      throw new ServerError(err.message);
    }
  }

  public async getTransactions(userId: string): Promise<any> {
    try {
      const transactions = await this._DB.Transaction.findAll({
        where: {
          userId: userId,
        },
        order: [["updatedAt", "DESC"]],
      });

      if (!transactions) {
        throw new BadRequestError("No transactions found for this user");
      }

      // Enhance transactions with contest/match data
      const enhancedTransactions = await this.enhanceTransactionsWithReferenceData(transactions);
      return enhancedTransactions;
    } catch (err: any) {
      logger.error(`DB error: ${err?.message ?? err}`);
      throw new ServerError(err.message);
    }
  }

  public async getWalletHistory(userId: string): Promise<any> {
    try {
      const transactions = await this._DB.Transaction.findAll({
        where: {
          userId: userId,
        },
        order: [["createdAt", "DESC"]],
      });

      if (!transactions || transactions.length === 0) {
        return [];
      }

      // Enhance transactions with contest/match data
      const enhancedTransactions = await this.enhanceTransactionsWithReferenceData(transactions);
      return enhancedTransactions;
    } catch (err: any) {
      logger.error(`DB error: ${err?.message ?? err}`);
      throw new ServerError(err.message);
    }
  }

  /**
   * Enhance transactions with contest/match reference data
   */
  private async enhanceTransactionsWithReferenceData(transactions: any[]): Promise<any[]> {
    try {
      const enhancedTransactions = await Promise.all(
        transactions.map(async (transaction) => {
          const transactionData = transaction.toJSON();
          
          // If no reference data, return as-is
          if (!transactionData.referenceId || !transactionData.referenceType) {
            return transactionData;
          }

          // Fetch reference data based on type
          let referenceData = null;
          
          try {
            if (transactionData.referenceType === 'contest') {
              // Contest data now includes match data from the internal endpoint
              referenceData = await this.fetchContestData(transactionData.referenceId);
            } else if (transactionData.referenceType === 'match') {
              referenceData = await this.fetchMatchData(transactionData.referenceId);
            }
          } catch (err) {
            logger.warn(`Failed to fetch ${transactionData.referenceType} data for ID ${transactionData.referenceId}: ${err}`);
          }

          return {
            ...transactionData,
            referenceData
          };
        })
      );

      return enhancedTransactions;
    } catch (err: any) {
      logger.error(`Error enhancing transactions: ${err?.message ?? err}`);
      // Return plain transactions if enhancement fails
      return transactions.map(t => t.toJSON());
    }
  }

  /**
   * Fetch contest data from contest service
   */
  private async fetchContestData(contestId: string): Promise<any> {
    try {
      const contestServiceUrl = ServerConfigs.CONTEST_SERVICE_URL || 'http://localhost:4005';
      const fullUrl = `${contestServiceUrl}/api/v1/contests/internal/${contestId}`;
      
      logger.info(`[WALLET] Attempting to fetch contest data from: ${fullUrl}`);
      logger.info(`[WALLET] Contest service URL config: ${ServerConfigs.CONTEST_SERVICE_URL}`);
      
      const response = await axios.get(fullUrl, {
        timeout: 10000, // Increased timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      logger.info(`[WALLET] Contest service response status: ${response.status}`);
      logger.info(`[WALLET] Contest service raw response: ${JSON.stringify(response.data)}`);
      
      const data = response.data as any;
      
      if (!data || !data.success) {
        logger.warn(`[WALLET] Contest service returned unsuccessful response for contest ${contestId}: ${JSON.stringify(data)}`);
        return null;
      }
      
      if (!data.data) {
        logger.warn(`[WALLET] Contest service returned no data for contest ${contestId}`);
        return null;
      }
      
      const contestData = {
        id: data.data.id,
        title: data.data.title,
        matchId: data.data.matchId,
        entryFee: data.data.entryFee,
        prizePool: data.data.prizePool,
        status: data.data.status,
        matchData: data.data.matchData || null
      };
      
      logger.info(`[WALLET] Successfully processed contest data for ${contestId}: ${JSON.stringify(contestData)}`);
      return contestData;
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED') {
        logger.error(`[WALLET] Contest service is not running at ${ServerConfigs.CONTEST_SERVICE_URL || 'http://localhost:4005'}`);
      } else if (err.response) {
        logger.error(`[WALLET] Contest service responded with error ${err.response.status}: ${JSON.stringify(err.response.data)}`);
      } else {
        logger.error(`[WALLET] Failed to fetch contest data for ${contestId}: ${err.message}`);
      }
      return null;
    }
  }

  /**
   * Fetch match data from match service
   */
  private async fetchMatchData(matchId: string): Promise<any> {
    try {
      const matchServiceUrl = ServerConfigs.MATCHES_SERVICE_URL || 'http://localhost:4004';
      const response = await axios.get(`${matchServiceUrl}/api/v1/matches/internal/${matchId}`, {
        timeout: 5000
      });
      
      const data = response.data as any;
      return {
        id: data.data?.id,
        title: data.data?.title,
        homeTeam: {
          name: data.data?.homeTeam?.name,
          shortName: data.data?.homeTeam?.shortName,
          logo: data.data?.homeTeam?.logo
        },
        awayTeam: {
          name: data.data?.awayTeam?.name,
          shortName: data.data?.awayTeam?.shortName,
          logo: data.data?.awayTeam?.logo
        },
        competition: data.data?.competition,
        matchDate: data.data?.matchDate,
        status: data.data?.status,
        venue: data.data?.venue
      };
    } catch (err: any) {
      const serviceUrl = ServerConfigs.CONTEST_SERVICE_URL || 'http://localhost:4005';
      
      if (err.code === 'ECONNREFUSED') {
        logger.error(`[WALLET] Contest service is not accessible at ${serviceUrl} - connection refused`);
      } else if (err.code === 'ETIMEDOUT') {
        logger.error(`[WALLET] Contest service request timed out`);
      } else {
        logger.error(`[WALLET] Failed to fetch contest data: ${err?.response?.status} - ${err?.response?.data?.message || err.message}`);
      }
      
      return null;
    }
  }

  /**
   * Withdraw coins from winning amount only (for coupon purchases/reward redemption)
   * This ensures only winnings can be used for rewards, not deposited amounts
   */
  public async withdrawFromWinningAmount(userId: string, amount: number, type: TransactionType, referenceId?: string, referenceType?: string): Promise<any> {
    try {
      const walletInfo = await this._DB.Wallet.findOne({
        where: {
          userId,
        },
      });

      if (!walletInfo) {
        throw new BadRequestError("Wallet not found for this user");
      }

      // Check if user has enough winning amount
      if (walletInfo.winningAmount < amount) {
        throw new BadRequestError("Insufficient winning balance. Only winning amount can be used for reward redemption.");
      }

      const walletPayload = {
        balance: walletInfo.balance - Number(amount),
        winningAmount: walletInfo.winningAmount - Number(amount),
        totalWithdrawn: walletInfo.totalWithdrawn + Number(amount),
      };

      const updatedWalletInfo = await this._DB.Wallet.update(walletPayload, {
        where: {
          userId,
        },
        returning: true,
      });

      let createTransaction;
      if (updatedWalletInfo[0]) {
        createTransaction = await this._DB.Transaction.create({
          walletId: walletInfo.id,
          type: type,
          userId: userId,
          amount: amount,
          balanceBefore: walletInfo.balance,
          balanceAfter: updatedWalletInfo[1][0].balance,
          referenceId: referenceId || null,
          referenceType: referenceType || null,
        });

        // Send notification for withdrawal
        await this.notificationHelper.sendWalletNotification(
          userId, 
          'withdrawal', 
          amount, 
          updatedWalletInfo[1][0].balance,
          type
        );
      }

      return {
        wallet: updatedWalletInfo[1][0],
        transaction: createTransaction,
      };
    } catch (err: any) {
      // Re-throw BadRequestError as-is to preserve the specific error message
      if (err instanceof BadRequestError) {
        throw err;
      }
      logger.error(`DB error in withdrawFromWinningAmount: ${err?.message ?? err}`);
      throw new ServerError(err.message);
    }
  }
}
