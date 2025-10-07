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

  public async getUser(req: Request, res: Response) {
    const payload = req.body;
    if (!req?.currentUser?.userId) {
      throw new BadRequestError();
    }

    const result = await this.userService.getUser(req.currentUser?.userId!);

    res.status(STATUS_CODE.SUCCESS).json({
      success: true,
      message: result.message,
      data: result.data,
      errors: null,
      timestamp: new Date().toISOString(),
    });
  }

  public async getAll(req: Request, res: Response) {
    try {
      const { search, active, page, pageSize } = req.query;

      let parsedActive: boolean | "all" | undefined;

      if (active === "true") parsedActive = true;
      else if (active === "false") parsedActive = false;
      else parsedActive = "all";

      const opts = {
        search: typeof search === "string" ? search : undefined,
        active: parsedActive,
        page: page ? Number(page) : 1,
        pageSize: pageSize ? Number(pageSize) : 50,
      };

      const result = await this.userService.list(opts);

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        message: "users fetched successfully",
        data: result,
        errors: null,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error("UserController.getAll error:", err);
      return res.status(STATUS_CODE.INTERNAL_SERVER ?? 500).json({
        success: false,
        message: "Failed to fetch users",
        data: null,
        errors: (err as Error).message ?? null,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
