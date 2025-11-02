// src/repositories/contest.repository.ts
import { Wallet } from "@/models/wallet.model";
import { BadRequestError, logger, ServerError } from "@repo/common";
import { DB, IDatabase } from "../configs/database.config";
import { TransactionType } from "../dtos/wallet.dto";

export default class WalletRepository {
  private _DB: IDatabase = DB;

  constructor() {
    this._DB = DB;
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
        totalDeposited: 0,
        totalWithdrawn: 0,
        totalWinnings: 0,
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

  public async withdrawCoins(userId: string, amount: number): Promise<any> {
    try {
      const walletInfo = await this._DB.Wallet.findOne({
        where: {
          userId,
        },
      });

      if (!walletInfo || walletInfo?.balance < amount) {
        throw new BadRequestError("Insufficient wallet balance");
      }

      const walletPayload = {
        balance: walletInfo?.balance - Number(amount),
        totalWithdrawn: walletInfo?.totalWithdrawn + Number(amount),
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
          type: "withdrawal",
          userId: userId,
          amount: amount,
          balanceBefore: walletInfo.balance,
          balanceAfter: updatedWalletInfo[1][0].balance,
        });
      }

      return {
        wallet: updatedWalletInfo[1][0],
        transaction: createTransaction,
      };
    } catch (err: any) {
      throw new ServerError(err.message);
    }
  }

  public async depositCoins(userId: string, amount: number,type :TransactionType): Promise<any> {
    try {
      const walletInfo = await this._DB.Wallet.findOne({
        where: {
          userId,
        },
      });

      if (!walletInfo) {
        throw new BadRequestError("Insufficient wallet balance");
      }

      const walletPayload = {
        balance: walletInfo?.balance + Number(amount),
        totalWinnings: walletInfo?.totalWinnings + Number(amount),
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
        });
      }

      return {
        wallet: updatedWalletInfo[1][0],
        transaction: createTransaction,
      };
    } catch (err: any) {
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

      return transactions;
    } catch (err: any) {
      logger.error(`DB error: ${err?.message ?? err}`);
      throw new ServerError(err.message);
    }
  }
}
