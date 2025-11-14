// src/routes/contest.routes.ts
import { Router } from "express";
import "reflect-metadata";
import { container } from "tsyringe";
import WalletController from "../controllers/wallet.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();
const walletController: WalletController = container.resolve(WalletController);

/**
 * Wallet Stats (must be before other /wallet routes)
 */
router.get("/wallet/stats", async (req, res) => {
  const result = await walletController.getWalletStats(req, res);
  return result;
});

/**
 * Wallet
 */
// get all user wallet info
router.get("/get-all-user-wallet", requireAuth, async (req, res) => {
  const result = await walletController.getAllUserWallet(req, res);
  return result;
});

// show wallet info
router.get("/wallet", requireAuth, async (req, res) => {
  const result = await walletController.showBalance(req, res);
  return result;
});

// debit from wallet
router.patch("/wallet/debit", requireAuth, async (req, res) => {
  const result = await walletController.debitBalance(req, res);
  return result;
});

router.get("/wallet/get-user-by-id/:userId", async (req, res) => {
  const result = await walletController.getUserById(req, res);
  return result;
});
// credit from wallet
router.patch("/wallet/credit", requireAuth, async (req, res) => {
  const result = await walletController.creditBalance(req, res);
  return result;
});

// get all user transactions
router.get("/wallet/transactions", requireAuth, async (req, res) => {
  const result = await walletController.getUserTransactions(req, res);
  return result;
});

// get wallet history by userId (admin endpoint)
router.get("/wallet/history/:userId", async (req, res) => {
  const result = await walletController.getUserWalletHistory(req, res);
  return result;
});

export default router;
