import { logger, STATUS_CODE } from "@repo/common";
import { Request, Response } from "express";
import { autoInjectable } from "tsyringe";
import ReferralRepository from "../repositories/referral.repository";
import UserRepository from "../repositories/user.repository";

@autoInjectable()
export default class ReferralController {
    private userRepository: UserRepository;
  constructor(
    private referralRepository: ReferralRepository = new ReferralRepository()
  ) {
    this.userRepository = new UserRepository();
  }

  /**
   * Get referral history for the logged-in user
   * @route GET /referrals/history
   */
  public async getReferralHistory(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const userId = req.params.userId || req.currentUser?.userId;

      if (!userId) {
        return res.status(STATUS_CODE.UN_AUTHORIZED).json({
          success: false,
          message: "Unauthorized",
          data: null,
        });
      }

      const referrals = await this.referralRepository.getReferralsByReferrer(
        userId
      );

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        message: "Referral history fetched successfully",
        data: referrals,
      });
    } catch (error: any) {
      logger.error(`Error fetching referral history: ${error.message}`);
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        message: "Failed to fetch referral history",
        data: null,
      });
    }
  }

  /**
   * Get referral statistics for the logged-in user
   * @route GET /referrals/stats
   */
  public async getReferralStats(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const userId = req.params.userId || req.currentUser?.userId;

      if (!userId) {
        return res.status(STATUS_CODE.UN_AUTHORIZED).json({
          success: false,
          message: "Unauthorized",
          data: null,
        });
      }

      const stats = await this.referralRepository.getReferralStats(userId);

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        message: "Referral stats fetched successfully",
        data: stats,
      });
    } catch (error: any) {
      logger.error(`Error fetching referral stats: ${error.message}`);
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        message: "Failed to fetch referral stats",
        data: null,
      });
    }
  }

  /**
   * Get user's own referral code
   * @route GET /referrals/my-code
   */
  public async getMyReferralCode(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const userId = req.currentUser?.userId;

      if (!userId) {
        return res.status(STATUS_CODE.UN_AUTHORIZED).json({
          success: false,
          message: "Unauthorized",
          data: null,
        });
      }

      const user = await this.userRepository.findById(userId);

      if (!user) {
        return res.status(STATUS_CODE.NOT_FOUND).json({
          success: false,
          message: "User not found",
          data: null,
        });
      }

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        message: "Referral code fetched successfully",
        data: {
          referralCode: user.referralCode,
          userName: user.userName,
        },
      });
    } catch (error: any) {
      logger.error(`Error fetching referral code: ${error.message}`);
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        message: "Failed to fetch referral code",
        data: null,
      });
    }
  }

  /**
   * Validate if a referral code exists in the database
   * @route GET /referrals/validate/:referralCode
   */
  public async validateReferralCode(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const { referralCode } = req.params;

      if (!referralCode) {
        return res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: "Referral code is required",
          data: { isValid: false },
        });
      }

      // Check if a user with this referral code exists
      const user = await this.userRepository.findByReferralCode(referralCode);

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        message: user ? "Referral code is valid" : "Referral code is invalid",
        data: { isValid: !!user },
      });
    } catch (error: any) {
      logger.error(`Error validating referral code: ${error.message}`);
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        message: "Failed to validate referral code",
        data: { isValid: false },
      });
    }
  }
}
