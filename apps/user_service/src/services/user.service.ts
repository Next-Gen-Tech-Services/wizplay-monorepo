import { autoInjectable } from "tsyringe";
import UserRepository from "../repositories/user.repository";

@autoInjectable()
export default class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  public async fetchTestData() {
    const result = await this.userRepository.getTestData();
    return result;
  }
}
