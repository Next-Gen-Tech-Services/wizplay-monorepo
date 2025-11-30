// src/controllers/contest.controller.ts
import { STATUS_CODE } from "@repo/common";
import { Request, Response } from "express";
import { autoInjectable } from "tsyringe";
import WalletService from "../services/wallet.service";
import { TransactionType } from "../dtos/wallet.dto";

@autoInjectable()
export default class WalletController {
  constructor(private readonly walletService: WalletService) {}

  public async getAllUserWallet(req: Request, res: Response) {
    const result = await this.walletService.getAllUserWallet();
    return res
      .status(STATUS_CODE.SUCCESS)
      .json({ success: true, data: result });
  }

  public async showBalance(req: Request, res: Response) {
    const userId: string = req.userId!;
    const result = await this.walletService.showBalance(userId);
    return res
      .status(STATUS_CODE.SUCCESS)
      .json({ success: true, data: result });
  }

  public async debitBalance(req: Request, res: Response) {
    const userId: string = req.userId!;
    const { amount,type = 'withdrawal' }: { amount: number,type?: TransactionType } = req.body;
    const result = await this.walletService.debitBalance(userId, amount,type);
    return res
      .status(STATUS_CODE.SUCCESS)
      .json({ success: true, data: result });
  }

  public async getUserById(req: Request, res: Response) {
    const userId: string = req.params.userId;
    const result = await this.walletService.getUserById(userId);
    return res
      .status(STATUS_CODE.SUCCESS)
      .json({ success: true, data: result });
  }
  
  public async creditBalance(req: Request, res: Response) {
    const userId: string = req.userId!;
    const { amount,type = 'deposit' }: { amount: number,type?: TransactionType } = req.body;
    const result = await this.walletService.creditBalance(userId, amount,type);
    return res
      .status(STATUS_CODE.SUCCESS)
      .json({ success: true, data: result });
  }

  /**
   * Credit contest winnings to user wallet (internal service call - no auth required)
   * This is called by contest_service to distribute prizes
   */
  public async creditContestWinnings(req: Request, res: Response) {
    const { userId, amount, contestId }: { userId: string, amount: number, contestId: string } = req.body;
    
    if (!userId || !amount || amount <= 0) {
      return res
        .status(STATUS_CODE.BAD_REQUEST)
        .json({ success: false, message: 'userId and valid amount are required' });
    }

    const result = await this.walletService.creditContestWinnings(userId, amount, contestId);
    return res
      .status(STATUS_CODE.SUCCESS)
      .json({ success: true, data: result });
  }

  public async getUserTransactions(req: Request, res: Response) {
    const userId: string = req.userId!;
    const result = await this.walletService.getUserTransactions(userId);
    return res
      .status(STATUS_CODE.SUCCESS)
      .json({ success: true, data: result });
  }

  public async getUserWalletHistory(req: Request, res: Response) {
    const userId: string = req.params.userId;
    const result = await this.walletService.getUserWalletHistory(userId);
    return res
      .status(STATUS_CODE.SUCCESS)
      .json({ success: true, data: result });
  }

  public async getWalletStats(req: Request, res: Response) {
    const result = await this.walletService.getWalletStats();
    return res
      .status(STATUS_CODE.SUCCESS)
      .json({ success: true, data: result });
  }
}
