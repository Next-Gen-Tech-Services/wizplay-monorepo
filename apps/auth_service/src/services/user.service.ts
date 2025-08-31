import { logger } from "@repo/common";
import "tsyringe";
import { autoInjectable } from "tsyringe";
import UserRepository from "../repositories/user.repository";
import { generateOTPUtil, generateUUID } from "../utils/utils";

@autoInjectable()
export default class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  public async fetchTestData() {
    const result = await this.userRepository.getTestData();
    return result;
  }

  public async generateOtp(phoneNumber: string): Promise<any> {
    const userExist =
      await this.userRepository.userWithPhoneExistRepo(phoneNumber);
    const otpCode: string = generateOTPUtil();
    logger.warn(`OTP Code : ${otpCode}`);
    if (userExist) {
      const updateOtp = await this.userRepository.updateRecentOtp({
        phoneNumber,
        otpCode,
      });
      logger.warn(`Update OTP: ${updateOtp}`);
      // SEND OTP HERE

      return {
        data: {
          userId: userExist.userId,
        },
        message: "otp sent successfully",
      };
    } else {
      const userId = generateUUID();
      const createUser = await this.userRepository.createAuthUserWithPhone({
        phoneNumber,
        userId,
        provider: "local",
      });

      const updateOtp = await this.userRepository.updateRecentOtp({
        phoneNumber,
        otpCode,
      });

      // SEND OTP HERE
      return {
        data: {
          userId: createUser.userId,
        },
        message: "otp sent successfully",
      };
    }
  }
}
