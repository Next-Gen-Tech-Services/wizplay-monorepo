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

  public async getUserById(req: Request, res: Response) {
    try {
      const userId = req.params.userId;

      if (!userId) {
        return res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: "User ID is required",
          data: null,
          errors: null,
          timestamp: new Date().toISOString(),
        });
      }

      const result = await this.userService.getUserById(userId);

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        message: "User fetched successfully",
        data: result.data,
        errors: null,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error("UserController.getUserById error:", err);
      return res.status(STATUS_CODE.NOT_FOUND ?? 404).json({
        success: false,
        message: "User not found",
        data: null,
        errors: (err as Error).message ?? null,
        timestamp: new Date().toISOString(),
      });
    }
  }

  public async updateDeviceToken(req: Request, res: Response) {
    try {
      const { deviceToken } = req.body;
      
      if (!req?.currentUser?.userId) {
        throw new BadRequestError();
      }

      if (!deviceToken) {
        return res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: "Device token is required",
          data: null,
          errors: null,
          timestamp: new Date().toISOString(),
        });
      }

      const result = await this.userService.updateDeviceToken(
        req.currentUser.userId,
        deviceToken
      );

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        message: "Device token updated successfully",
        data: result.data,
        errors: null,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error("UserController.updateDeviceToken error:", err);
      return res.status(STATUS_CODE.INTERNAL_SERVER ?? 500).json({
        success: false,
        message: "Failed to update device token",
        data: null,
        errors: (err as Error).message ?? null,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Service-to-service methods for notification service
  public async getUserByEmail(req: Request, res: Response) {
    try {
      const email = decodeURIComponent(req.params.email);

      if (!email) {
        return res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: "Email is required",
          data: null,
          errors: null,
          timestamp: new Date().toISOString(),
        });
      }

      const result = await this.userService.getUserByEmail(email);

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        message: "User found",
        data: result.data,
        errors: null,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error("UserController.getUserByEmail error:", err);
      return res.status(STATUS_CODE.NOT_FOUND ?? 404).json({
        success: false,
        message: "User not found",
        data: null,
        errors: (err as Error).message ?? null,
        timestamp: new Date().toISOString(),
      });
    }
  }

  public async getUserByPhone(req: Request, res: Response) {
    try {
      const phone = decodeURIComponent(req.params.phone);

      if (!phone) {
        return res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: "Phone number is required",
          data: null,
          errors: null,
          timestamp: new Date().toISOString(),
        });
      }

      const result = await this.userService.getUserByPhone(phone);

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        message: "User found",
        data: result.data,
        errors: null,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error("UserController.getUserByPhone error:", err);
      return res.status(STATUS_CODE.NOT_FOUND ?? 404).json({
        success: false,
        message: "User not found",
        data: null,
        errors: (err as Error).message ?? null,
        timestamp: new Date().toISOString(),
      });
    }
  }

  public async getAllDeviceTokens(req: Request, res: Response) {
    try {
      const result = await this.userService.getAllDeviceTokens();

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        message: "Device tokens retrieved",
        data: result.data,
        errors: null,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error("UserController.getAllDeviceTokens error:", err);
      return res.status(STATUS_CODE.INTERNAL_SERVER ?? 500).json({
        success: false,
        message: "Failed to get device tokens",
        data: null,
        errors: (err as Error).message ?? null,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
