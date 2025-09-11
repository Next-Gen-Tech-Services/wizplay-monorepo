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

  public async updateName(name: string, userId: string) {
    try {
      const result = await this.userRepository.updateNameWithId(userId, name);
      if (!result) {
        throw new BadRequestError("error updating user name");
      }
      return { data: result[1][0], message: "user name updated successfully" };
    } catch (error: any) {
      throw new BadRequestError(error.message);
    }
  }
}
