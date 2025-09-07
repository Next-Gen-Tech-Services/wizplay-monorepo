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
    const { phoneNumber, otp } = req.body;

    try {
      const result = await this.authService.verifyOtp(phoneNumber, otp);
      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        data: {
          userId: result.userId,
          userStatus: result.userStatus, // "new" | "existing"
          onboarded: result.onboarded,
        },
        message: "otp verified",
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
}
