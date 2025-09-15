import { BadRequestError, STATUS_CODE } from "@repo/common";
import { Request, Response } from "express";
import { autoInjectable } from "tsyringe";
import UserService from "../services/user.service";

@autoInjectable()
export default class UserController {
  constructor(private readonly userService: UserService) {}

  public async update(req: Request, res: Response) {
    const payload = req.body;
    if (!req?.currentUser?.userId) {
      throw new BadRequestError();
    }

    const result = await this.userService.update(
      payload,
      req.currentUser?.userId!
    );

    res.status(STATUS_CODE.SUCCESS).json({
      success: true,
      message: result.message,
      data: result.data,
      errors: null,
      timestamp: new Date().toISOString(),
    });
  }
}
