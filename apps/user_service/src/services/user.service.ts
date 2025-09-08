import { autoInjectable } from "tsyringe";
import redis, { IRedis } from "../configs/redis.config";
import UserRepository from "../repositories/user.repository";

@autoInjectable()
export default class UserService {
  private redis: IRedis;
  constructor(private readonly userRepository: UserRepository) {
    this.redis = redis;
  }

  public async fetchTestData() {
    const result = await this.userRepository.getTestData();
    return result;
  }
}
