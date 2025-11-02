import { logger } from "@repo/common";
import { DB, IDatabase } from "../configs/database.config";

export default class ReferralRepository {
  private _DB: IDatabase = DB;

  constructor() {
    this._DB = DB;
  }

  /**
   * Create a referral record when a user uses a referral code
   */
  public async createReferral(
    referralCode: string,
    referredUserId: string
  ): Promise<any> {
    try {
      // Find the referrer by their referral code
      const referrer = await this._DB.User.findOne({
        where: { referralCode },
      });

      if (!referrer) {
        logger.warn(`No user found with referral code: ${referralCode}`);
        return null;
      }

      // Check if this user was already referred
      const existingReferral = await this._DB.Referral.findOne({
        where: { referredUserId },
      });

      if (existingReferral) {
        logger.warn(`User ${referredUserId} was already referred`);
        return existingReferral;
      }

      // Create referral record
      const referral = await this._DB.Referral.create({
        referrerId: referrer.userId,
        referredUserId,
        referralCode,
        rewardAmount: 50,
        rewardStatus: "completed",
      });

      logger.info(
        `Referral created: ${referredUserId} referred by ${referrer.userId}`
      );
      return referral;
    } catch (error: any) {
      logger.error(`Error creating referral: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all referrals made by a user
   */
  public async getReferralsByReferrer(referrerId: string): Promise<any> {
    try {
      const referrals = await this._DB.Referral.findAll({
        where: { referrerId },
        order: [["createdAt", "DESC"]],
      });

      return referrals;
    } catch (error: any) {
      logger.error(`Error fetching referrals: ${error.message}`);
      return [];
    }
  }

  /**
   * Get referral statistics for a user
   */
  public async getReferralStats(userId: string): Promise<any> {
    try {
      const totalReferrals = await this._DB.Referral.count({
        where: { referrerId: userId },
      });

      const completedReferrals = await this._DB.Referral.count({
        where: { referrerId: userId, rewardStatus: "completed" },
      });

      const totalEarned = await this._DB.Referral.sum("rewardAmount", {
        where: { referrerId: userId, rewardStatus: "completed" },
      });

      return {
        totalReferrals,
        completedReferrals,
        totalEarned: totalEarned || 0,
      };
    } catch (error: any) {
      logger.error(`Error fetching referral stats: ${error.message}`);
      return {
        totalReferrals: 0,
        completedReferrals: 0,
        totalEarned: 0,
      };
    }
  }

  /**
   * Update referral reward status
   */
  public async updateReferralStatus(
    referralId: string,
    status: "pending" | "completed" | "failed"
  ): Promise<any> {
    try {
      await this._DB.Referral.update(
        { rewardStatus: status },
        { where: { id: referralId } }
      );

      logger.info(`Referral ${referralId} status updated to ${status}`);
      return true;
    } catch (error: any) {
      logger.error(`Error updating referral status: ${error.message}`);
      return false;
    }
  }
}
