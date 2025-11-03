// src/services/contest.service.ts
import { ServerError } from "@repo/common";
import { autoInjectable } from "tsyringe";
import WalletRepository from "../repositories/wallet.repository";
import { TransactionType } from "../dtos/wallet.dto";

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
}
