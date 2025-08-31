import { logger, STATUS_CODE } from "@repo/common";
import { Request, Response } from "express";
import "tsyringe";
import { autoInjectable } from "tsyringe";
import UserService from "../services/user.service";

@autoInjectable()
export default class UserController {
  constructor(private readonly userService: UserService) {}

  public async testResponse(req: Request, res: Response) {
    const result = await this.userService.fetchTestData();
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
    const result = await this.userService.generateOtp(phoneNumber);

    return res.status(STATUS_CODE.SUCCESS).json({
      success: true,
      data: result.data,
      message: result.message,
      errors: null,
      timestamp: new Date().toISOString(),
    });
  }
}
