// src/routes/contest.routes.ts
import { Router } from "express";
import "reflect-metadata";
import { container } from "tsyringe";
import WalletController from "../controllers/wallet.controller";

const router = Router();
const walletController: WalletController = container.resolve(WalletController);

/**
 * Wallet
 */
router.get("/wallet", async (req, res) => {
  const result = await walletController.showBalance(req, res);
  return result;
});

export default router;
