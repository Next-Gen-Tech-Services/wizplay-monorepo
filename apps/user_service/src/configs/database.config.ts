import { logger } from "@repo/common";
import { Sequelize } from "sequelize";
import referralModel, { Referral } from "../models/referral.model";
import userModel, { User } from "../models/user.model";
import wishlistModel, { Wishlist } from "../models/wishlist.model";
import ServerConfigs from "./server.config";

export interface IDatabase {
  Sequelize: any;
  sequelize: Sequelize;
  User: typeof User;
  Wishlist: typeof Wishlist;
  Referral: typeof Referral;
}

const sequelize = new Sequelize({
  dialect: "postgres",
  database: ServerConfigs.DATABASE_NAME,
  username: ServerConfigs.DATABASE_USERNAME,
  password: ServerConfigs.DATABASE_PASSWORD,
  host: ServerConfigs.DATABASE_HOST,
  port: Number(ServerConfigs.DATABASE_PORT) || 5432,
  dialectOptions: {
    ssl: {
      require: false,
      rejectUnauthorized: false,
    },
  },
  logging: false,
  define: {
    charset: "utf8mb4",
    underscored: true,
  },
});

const UserInstance = userModel(sequelize);
const WishlistInstance = wishlistModel(sequelize);
const ReferralInstance = referralModel(sequelize);

export async function connectDatabase() {
  try {
    await sequelize.authenticate();
    if (ServerConfigs.DB_SYNC === 'true') {
      await sequelize.sync({ alter: true });
      logger.info("Database synced ✅");
    }
    logger.info("Database connection established ✅");
  } catch (error: any) {
    logger.error(`Error connecting database: ${error} `);
  }
}

export const DB: IDatabase = {
  Sequelize,
  sequelize,
  User: UserInstance,
  Wishlist: WishlistInstance,
  Referral: ReferralInstance,
};
