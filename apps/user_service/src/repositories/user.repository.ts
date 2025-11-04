import { logger } from "@repo/common";
import { Op } from "sequelize/lib/operators";
import { DB, IDatabase } from "../configs/database.config";
import { KAFKA_EVENTS, Language } from "../types";
import { publishUserEvent } from "../utils/kafka";
import { generateReferralCode } from "../utils/referral.utils";
import { generateUniqueUsername } from "../utils/username";
import ReferralRepository from "./referral.repository";

export default class UserRepository {
  private _DB: IDatabase = DB;
  private referralRepository: ReferralRepository;

  constructor() {
    this._DB = DB;
    this.referralRepository = new ReferralRepository();
  }

  public async createUser(
    userId: string,
    authId: string,
    email?: string,
    phoneNumber?: string,
    usedReferralCode?: string
  ): Promise<any> {
    try {
      const generatedUsername = generateUniqueUsername();
      
      // Generate unique referral code for this new user
      let referralCode = generateReferralCode();
      let attempts = 0;
      const maxAttempts = 5;

      // Ensure referral code is unique
      while (attempts < maxAttempts) {
        const existing = await this._DB.User.findOne({
          where: { referralCode },
        });

        if (!existing) break;

        referralCode = generateReferralCode();
        attempts++;
      }

      if (attempts === maxAttempts) {
        throw new Error("Failed to generate unique referral code");
      }

      const newUser = await this._DB.User.create(
        {
          authId,
          userId,
          email,
          phoneNumber,
          type: "user",
          userName: generatedUsername,
          selectedLanguage: Language.ENGLISH,
          referralCode,
        },
        {
          returning: true,
        }
      );

      if (newUser) {
        logger.info(`User created with referral code: ${referralCode}`);

        // If user used a referral code, create referral record and trigger reward
        if (usedReferralCode) {
          const referral = await this.referralRepository.createReferral(
            usedReferralCode,
            newUser.userId
          );

          if (referral) {
            // Publish event to wallet service to reward the referrer
            await publishUserEvent(KAFKA_EVENTS.REFERRAL_REWARD, {
              referralId: referral.id,
              referrerId: referral.referrerId,
              referredUserId: newUser.userId,
              rewardAmount: 50,
            });
            logger.info(`Referral reward event published for ${referral.referrerId}`);
          }
        }

        await publishUserEvent(KAFKA_EVENTS.USER_ONBOARDED, {
          userId: newUser.userId,
          authId: newUser.authId,
        });
      }
      return newUser;
    } catch (error: any) {
      logger.error(`[Error creating new user: ${error.message}]`);
    }
  }

  public async getUserWithId(userId: string, authId: string): Promise<any> {
    try {
      const user = await this._DB.User.findOne({
        where: {
          userId: userId,
          authId: authId,
        },
      });
      return user;
    } catch (error: any) {
      logger.error(`[Error creating new user: ${error.message}]`);
    }
  }

  public async getUserById(authId: string): Promise<any> {
    try {
      const user = await this._DB.User.findOne({
        where: {
          authId: authId,
        },
      });
      return user;
    } catch (error: any) {
      logger.error(`[Error creating new user: ${error.message}]`);
    }
  }

  public async updateWithId(
    userId: string,
    payload: { name: string; email: string }
  ): Promise<any> {
    try {
      const user = await this._DB.User.update(payload, {
        where: {
          userId: userId,
        },
        returning: true,
      });
      return user;
    } catch (error: any) {
      logger.error(`[Error updating user name: ${error.message}]`);
    }
  }

  public async findById(userId: string): Promise<any> {
    try {
      const user = await this._DB.User.findOne({
        where: {
          userId: userId,
        },
      });
      return user;
    } catch (error: any) {
      logger.error(`[Error fetching user details: ${error.message}]`);
    }
  }

  public async findByReferralCode(referralCode: string): Promise<any> {
    try {
      const user = await this._DB.User.findOne({
        where: {
          referralCode: referralCode,
        },
      });
      return user;
    } catch (error: any) {
      logger.error(`[Error finding user by referral code: ${error.message}]`);
      return null;
    }
  }

  public async list(opts: {
    search?: string;
    active?: "all" | boolean;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: any[]; total: number; page: number; pageSize: number }> {
    try {
      const { search, active, page = 1, pageSize = 50 } = opts;
      const where: any = {
        type: "user",
      };

      // 🔍 Search filter (matches userName, email, phoneNumber)
      if (search) {
        const q = `%${search}%`;
        where[Op.or] = [
          { userName: { [Op.iLike]: q } },
          { email: { [Op.iLike]: q } },
          { phoneNumber: { [Op.iLike]: q } },
        ];
      }

      // ✅ Active filter
      if (active === true) where.active = true;
      if (active === false) where.active = false;

      const offset = (page - 1) * pageSize;

      // ⚡ Paginated query
      const { rows, count } = await this._DB.User.findAndCountAll({
        where,
        limit: pageSize,
        offset,
        order: [["createdAt", "DESC"]],
      });

      return {
        items: rows,
        total: count,
        page,
        pageSize,
      };
    } catch (error: any) {
      logger.error(`[Error listing users: ${error.message}]`);
      return { items: [], total: 0, page: 1, pageSize: 50 };
    }
  }

  public async updateDeviceToken(userId: string, deviceToken: string): Promise<any> {
    try {
      const result = await this._DB.User.update(
        { deviceToken },
        {
          where: { userId },
          returning: true,
        }
      );
      return result;
    } catch (error: any) {
      logger.error(`[Error updating device token: ${error.message}]`);
      throw error;
    }
  }
}
