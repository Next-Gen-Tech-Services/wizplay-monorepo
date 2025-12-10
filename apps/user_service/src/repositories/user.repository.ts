import { logger } from "@repo/common";
import { Op } from "sequelize";
import { DB, IDatabase } from "../configs/database.config";
import ServerConfigs from "../configs/server.config";
import { KAFKA_EVENTS, Language } from "../types";
import { publishUserEvent } from "../utils/kafka";
import { generateReferralCode } from "../utils/referral.utils";
import { generateUniqueUsername } from "../utils/username";
import ReferralRepository from "./referral.repository";
import axios from "axios";

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

  public async findByIdWithDetails(userId: string): Promise<any> {
    try {
      const user = await this._DB.User.findOne({
        where: {
          userId: userId,
        },
      });

      if (!user) {
        return null;
      }

      const userData = user.toJSON();

      // Fetch wallet data from wallet service
      let walletData = null;
      try {
        const walletServiceUrl = ServerConfigs.WALLET_SERVICE_URL || "http://localhost:4006";
        const walletResponse = await axios.get(
          `${walletServiceUrl}/api/v1/wallet/get-user-by-id/${userData.userId}`,
          {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 3000,
          }
        );
        walletData = walletResponse.data?.data || null;
      } catch (walletErr: any) {
        logger.error(`Failed to fetch wallet data for user ${userData.userId}: ${walletErr?.message ?? walletErr}`);
      }

      // Fetch auth data from auth service
      let authData = null;
      try {
        const authServiceUrl = ServerConfigs.AUTH_SERVICE_URL || "http://localhost:4001";
        const authResponse = await axios.get(
          `${authServiceUrl}/api/v1/auth/user/${userData.userId}`,
          {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 3000,
          }
        );
        authData = authResponse.data?.data || null;
      } catch (authErr: any) {
        logger.error(`Failed to fetch auth data for user ${userData.userId}: ${authErr?.message ?? authErr}`);
      }

      return {
        ...userData,
        walletData,
        authData,
      };
    } catch (error: any) {
      logger.error(`[Error fetching user details with data: ${error.message}]`);
      throw error;
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

      // Fetch wallet data and auth data for each user
      const usersWithData = await Promise.all(
        rows.map(async (user: any) => {
          const userData = user.toJSON();

          // Fetch wallet data from wallet service
          let walletData = null;
          try {
            const walletServiceUrl = ServerConfigs.WALLET_SERVICE_URL || "http://localhost:4006";
            const walletResponse = await axios.get(
              `${walletServiceUrl}/api/v1/wallet/get-user-by-id/${userData.userId}`,
              {
                headers: {
                  'Content-Type': 'application/json',
                },
                timeout: 3000,
              }
            );
            logger.info(`Fetched wallet data for user ${userData.userId}`);
            walletData = walletResponse.data?.data || null;
          } catch (walletErr: any) {
            logger.error(`Failed to fetch wallet data for user ${userData.userId}: ${walletErr?.message ?? walletErr}`);
          }

          // Fetch auth data from auth service
          let authData = null;
          try {
            const authServiceUrl = ServerConfigs.AUTH_SERVICE_URL || "http://localhost:4001";
            const authResponse = await axios.get(
              `${authServiceUrl}/api/v1/auth/user/${userData.userId}`,
              {
                headers: {
                  'Content-Type': 'application/json',
                },
                timeout: 3000,
              }
            );
            authData = authResponse.data?.data || null;
          } catch (authErr: any) {
            logger.error(`Failed to fetch auth data for user ${userData.userId}: ${authErr?.message ?? authErr}`);
          }

          return {
            ...userData,
            walletData,
            authData,
          };
        })
      );

      return {
        items: usersWithData,
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

  // Service-to-service methods for notification service
  public async findByEmail(email: string): Promise<any> {
    try {
      const result = await this._DB.User.findOne({
        where: { email },
        attributes: ['userId', 'email', 'phoneNumber', 'deviceToken', 'name']
      });
      return result;
    } catch (error: any) {
      logger.error(`[Error finding user by email: ${error.message}]`);
      throw error;
    }
  }

  public async findByPhone(phoneNumber: string): Promise<any> {
    try {
      const result = await this._DB.User.findOne({
        where: { phoneNumber },
        attributes: ['userId', 'email', 'phoneNumber', 'deviceToken', 'name']
      });
      return result;
    } catch (error: any) {
      logger.error(`[Error finding user by phone: ${error.message}]`);
      throw error;
    }
  }

  public async getAllDeviceTokens(): Promise<string[]> {
    try {
      const users = await this._DB.User.findAll({
        where: { 
          deviceToken: { [Op.ne]: null }
        },
        attributes: ['deviceToken']
      });
      
      return users
        .map((user: any) => user.deviceToken)
        .filter((token: string) => token && token.trim());
    } catch (error: any) {
      logger.error(`[Error getting all device tokens: ${error.message}]`);
      throw error;
    }
  }
}
