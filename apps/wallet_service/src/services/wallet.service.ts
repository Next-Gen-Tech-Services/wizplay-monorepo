// src/services/contest.service.ts
import { autoInjectable } from "tsyringe";
import WalletRepository from "../repositories/wallet.repository";
import { GenerativeAi } from "../utils/generativeAi";

@autoInjectable()
export default class ContestService {
  private generativeAI: GenerativeAi;
  constructor(private readonly repo: WalletRepository) {
    this.generativeAI = new GenerativeAi();
  }

  public async showBalance(userId: string) {
    const walletInfo = await this.repo.getWallet(userId);
    return walletInfo;
  }
}
