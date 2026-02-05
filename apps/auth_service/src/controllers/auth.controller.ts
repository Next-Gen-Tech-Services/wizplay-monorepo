import { logger, STATUS_CODE } from "@repo/common";
import { Request, Response } from "express";
import "tsyringe";
import { autoInjectable } from "tsyringe";
import AuthService from "../services/auth.service";

@autoInjectable()
export default class AuthController {
  constructor(private readonly authService: AuthService) {}

  public async testResponse(req: Request, res: Response) {
    const result = await this.authService.fetchTestData();
    logger.info(
      "Request ID:" + req.headers["x-request-id"] + " | message: " + "Success"
    );

    res.status(STATUS_CODE.SUCCESS).json({
      success: true,
      message: "test route",
      data: result,
    });
  }

  public async generateOtpController(
    req: Request,
    res: Response
  ): Promise<any> {
    const { phoneNumber } = req.body;
    const result = await this.authService.generateOtp(phoneNumber);

    return res.status(STATUS_CODE.SUCCESS).json({
      success: true,
      data: result.data,
      message: result.message,
      errors: null,
      timestamp: new Date().toISOString(),
    });
  }

  public async verifyOtpController(req: Request, res: Response): Promise<any> {
    const { phoneNumber, otp, referralCode } = req.body;

    try {
      const result = await this.authService.verifyOtp(phoneNumber, otp, referralCode);
      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        data: result.data,
        token: result.token,
        message: result.message,
        errors: null,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(STATUS_CODE.BAD_REQUEST).json({
        success: false,
        data: null,
        message: err?.message || "Invalid or expired OTP",
        errors: null,
        timestamp: new Date().toISOString(),
      });
    }
  }

  public async loginWithEmailPass(req: Request, res: Response) {
    const { email, password } = req.body;

    const result = await this.authService.loginWithPass(email, password);

    return res.status(STATUS_CODE.SUCCESS).json({
      success: true,
      data: result.data,
      message: result.message,
      errors: null,
      timestamp: new Date().toISOString(),
    });
  }

  public async forgetPassword(req: Request, res: Response) {
    const { email } = req.body;

    const result = await this.authService.sendForgerPassLink(email);

    return res.status(STATUS_CODE.SUCCESS).json({
      success: true,
      data: result.data,
      message: result.message,
      errors: null,
      timestamp: new Date().toISOString(),
    });
  }

  public async resetPassword(req: Request, res: Response) {
    const { email, password, token } = req.body;

    const result = await this.authService.resetPassword(email, password, token);

    return res.status(STATUS_CODE.SUCCESS).json({
      success: true,
      data: result.data,
      message: result.message,
      errors: null,
      timestamp: new Date().toISOString(),
    });
  }

  public async authWithGoogle(req: Request, res: Response) {
    const { auth_code,platform } = req.body;
    const result = await this.authService.googleAuth(auth_code,platform);

    return res.status(STATUS_CODE.SUCCESS).json({
      success: true,
      data: result.data,
      token: result.token,
      message: result.message,
      errors: null,
      timestamp: new Date().toISOString(),
    });
  }

  public async authWithApple(req: Request, res: Response) {
    try {
      const { identity_token, first_name, last_name } = req.body;
      const result = await this.authService.appleAuth(identity_token, first_name, last_name);

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        data: result.data,
        token: result.token,
        message: result.message,
        errors: null,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(STATUS_CODE.BAD_REQUEST).json({
        success: false,
        data: null,
        message: err?.message || "Apple authentication failed",
        errors: null,
        timestamp: new Date().toISOString(),
      });
    }
  }

  public async getAuthByUserId(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          data: null,
          message: "User ID is required",
          errors: null,
          timestamp: new Date().toISOString(),
        });
      }

      const result = await this.authService.getAuthByUserId(userId);

      if (!result) {
        return res.status(STATUS_CODE.NOT_FOUND).json({
          success: false,
          data: null,
          message: "Auth record not found",
          errors: null,
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        data: result,
        message: "Auth data fetched successfully",
        errors: null,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        data: null,
        message: err?.message || "Failed to fetch auth data",
        errors: null,
        timestamp: new Date().toISOString(),
      });
    }
  }

  public async updateAuthStatus(req: Request, res: Response): Promise<any> {
    try {
      const { userId } = req.params;
      const { status } = req.body;

      if (!userId) {
        return res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          data: null,
          message: "User ID is required",
          errors: null,
          timestamp: new Date().toISOString(),
        });
      }

      if (!status || !["active", "inactive", "suspended", "banned"].includes(status)) {
        return res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          data: null,
          message: "Valid status is required (active, inactive, suspended, banned)",
          errors: null,
          timestamp: new Date().toISOString(),
        });
      }

      const result = await this.authService.updateAuthStatus(userId, status);

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        data: result.data,
        message: result.message,
        errors: null,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      logger.error("AuthController.updateAuthStatus error:", err);
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        data: null,
        message: err?.message || "Failed to update auth status",
        errors: null,
        timestamp: new Date().toISOString(),
      });
    }
  }

  public async deleteAccount(req: Request, res: Response): Promise<any> {
    try {
      const userId = req.currentUserId;

      if (!userId) {
        return res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          data: null,
          message: "User ID not found in token",
          errors: null,
          timestamp: new Date().toISOString(),
        });
      }

      const result = await this.authService.deleteAccount(userId);

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        data: null,
        message: result.message,
        errors: null,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      logger.error("AuthController.deleteAccount error:", err);
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        data: null,
        message: err?.message || "Failed to deactivate account",
        errors: null,
        timestamp: new Date().toISOString(),
      });
    }
  }

  public async verifyUserStatus(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          data: null,
          message: "User ID is required",
          errors: null,
          timestamp: new Date().toISOString(),
        });
      }

      const result = await this.authService.getAuthByUserId(userId);

      if (!result) {
        return res.status(STATUS_CODE.NOT_FOUND).json({
          success: false,
          data: null,
          message: "User not found",
          errors: null,
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        data: { status: result.status },
        message: "User status verified",
        errors: null,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      logger.error("AuthController.verifyUserStatus error:", err);
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        data: null,
        message: err?.message || "Failed to verify user status",
        errors: null,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
