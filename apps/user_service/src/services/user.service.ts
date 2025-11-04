import { BadRequestError } from "@repo/common";
import { autoInjectable } from "tsyringe";
import redis, { IRedis } from "../configs/redis.config";
import UserRepository from "../repositories/user.repository";

@autoInjectable()
export default class UserService {
  private redis: IRedis;
  constructor(private readonly userRepository: UserRepository) {
    this.redis = redis;
  }

  public async update(
    payload: { name: string; email: string },
    userId: string
  ) {
    try {
      const result = await this.userRepository.updateWithId(userId, payload);
      if (!result) {
        throw new BadRequestError("error updating user name");
      }
      return { data: result[1][0], message: "user name updated successfully" };
    } catch (error: any) {
      throw new BadRequestError(error.message);
    }
  }
  public async getUser(userId: string) {
    try {
      const result = await this.userRepository.findById(userId);
      if (!result) {
        throw new BadRequestError("error fetching user details");
      }
      return { data: result, message: "user details fetched successfully" };
    } catch (error: any) {
      throw new BadRequestError(error.message);
    }
  }

  public async list(opts: {
    search?: string;
    active?: "all" | boolean;
    page?: number;
    pageSize?: number;
  }) {
    try {
      const { search = "", active = "all", page = 1, pageSize = 50 } = opts;

      const result = await this.userRepository.list({
        search: search || undefined,
        active: active === "all" ? "all" : active,
        page,
        pageSize,
      });

      return result;
    } catch (error: any) {
      throw new BadRequestError(error.message || "Failed to list users");
    }
  }

  public async getUserById(userId: string) {
    try {
      const result = await this.userRepository.findById(userId);
      if (!result) {
        throw new BadRequestError("User not found");
      }
      return { data: result, message: "User fetched successfully" };
    } catch (error: any) {
      throw new BadRequestError(error.message || "Failed to fetch user");
    }
  }

  public async updateDeviceToken(userId: string, deviceToken: string) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new BadRequestError("User not found");
      }

      // Update device token through repository
      await this.userRepository.updateDeviceToken(userId, deviceToken);

      const updatedUser = await this.userRepository.findById(userId);
      return { data: updatedUser, message: "Device token updated successfully" };
    } catch (error: any) {
      throw new BadRequestError(error.message || "Failed to update device token");
    }
  }
}
