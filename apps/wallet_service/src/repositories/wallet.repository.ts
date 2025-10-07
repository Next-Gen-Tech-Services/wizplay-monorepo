// src/repositories/contest.repository.ts
import { Wallet } from "@/models/wallet.model";
import { BadRequestError, ServerError } from "@repo/common";
import { DB, IDatabase } from "../configs/database.config";

export default class WalletRepository {
  private _DB: IDatabase = DB;

  constructor() {
    this._DB = DB;
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
        balance: walletInfo?.balance - amount,
        totalWithdrawn: walletInfo?.totalWithdrawn + amount,
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

  public async depositCoins(userId: string, amount: number): Promise<any> {
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
        balance: walletInfo?.balance + amount,
        totalWinnings: walletInfo?.totalWinnings + amount,
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
          type: "contest_winnings",
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
}
