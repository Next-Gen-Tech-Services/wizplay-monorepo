// src/services/contest.service.ts
import { ServerError } from "@repo/common";
import { autoInjectable } from "tsyringe";
import WalletRepository from "../repositories/wallet.repository";
import { GenerativeAi } from "../utils/generativeAi";

@autoInjectable()
export default class ContestService {
  private generativeAI: GenerativeAi;
  constructor(private readonly repo: WalletRepository) {
    this.generativeAI = new GenerativeAi();
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

  public async debitBalance(userId: string, amount: number) {
    try {
      const transactionInfo = await this.repo.withdrawCoins(userId, amount);
      return transactionInfo;
    } catch (error: any) {
      throw new ServerError(`Error withdrawing wallet data: ${error.message}`);
    }
  }

  public async creditBalance(userId: string, amount: number) {
    try {
      const transactionInfo = await this.repo.depositCoins(userId, amount);
      return transactionInfo;
    } catch (error: any) {
      throw new ServerError(`Error credit wallet data: ${error.message}`);
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
