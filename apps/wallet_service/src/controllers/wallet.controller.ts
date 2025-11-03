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

  public async creditBalance(req: Request, res: Response) {
    const userId: string = req.userId!;
    const { amount,type = 'deposit' }: { amount: number,type?: TransactionType } = req.body;
    const result = await this.walletService.creditBalance(userId, amount,type);
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
}
