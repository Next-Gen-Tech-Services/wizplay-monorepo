import { logger, STATUS_CODE } from "@repo/common";
import { Request, Response } from "express";
import { autoInjectable } from "tsyringe";
import UserService from "../services/user.service";

@autoInjectable()
export default class UserController {
  constructor(private readonly userService: UserService) { }

  public async testResponse(req: Request, res: Response) {
    const result = await this.userService.fetchTestData();
    logger.info(
      "Request ID:" + req.headers["x-request-id"] + " | message: " + "Success",
    );

    res.status(STATUS_CODE.SUCCESS).json({
      success: true,
      message: "test route",
      data: result,
    });
  }
}
