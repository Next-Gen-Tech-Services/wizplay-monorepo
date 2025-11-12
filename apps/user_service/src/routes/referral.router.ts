import { Router } from "express";
import "reflect-metadata";
import { container } from "tsyringe";
import ReferralController from "../controllers/referral.controller";
import { requireAdminAuth, requireAuth } from "../middlewares/auth.middleware";

const router = Router();
const controller: ReferralController = container.resolve(ReferralController);

/**
 * GET /referrals/validate/:referralCode
 * Validate if a referral code exists (public endpoint)
 */
router.get("/validate/:referralCode", async (req, res) => {
  return controller.validateReferralCode(req, res);
});

/**
 * GET /referrals/my-code
 * Get current user's referral code
 */
router.get("/my-code", requireAuth, async (req, res) => {
  return controller.getMyReferralCode(req, res);
});

/**
 * GET /history
 * Get current user's referral history
 */
router.get("/history", requireAuth, async (req, res) => {
  return controller.getReferralHistory(req, res);
});

/**
 * GET /stats
 * Get current user's referral statistics
 */
router.get("/stats", requireAuth, async (req, res) => {
  return controller.getReferralStats(req, res);
});

/**
 * GET /stats
 * Get current user's referral statistics
 */
router.get("/stats/:userId", requireAdminAuth, async (req, res) => {
  return controller.getReferralStats(req, res);
});

/**
 * GET /history
 * Get current user's referral history
 */
router.get("/history/:userId", requireAdminAuth, async (req, res) => {
  return controller.getReferralHistory(req, res);
});

export default router;
