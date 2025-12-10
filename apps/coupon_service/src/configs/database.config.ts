import { logger } from "@repo/common";
import { Sequelize } from "sequelize";
import contestCouponModel, {
  ContestCoupon,
} from "../models/contestCoupon.model";
import couponModel, { Coupon } from "../models/coupon.model";
import userCouponModel, { UserCoupon } from "../models/userCoupon.model";
import ServerConfigs from "./server.config";

export interface IDatabase {
  Sequelize: any;
  sequelize: Sequelize;
  Coupon: typeof Coupon;
  ContestCoupon: typeof ContestCoupon;
  UserCoupon: typeof UserCoupon;
}

// SSL configuration
const useSSL = ServerConfigs.DB_SSL === "true";
const sequelize = new Sequelize({
  dialect: "postgres",
  database: ServerConfigs.DATABASE_NAME,
  username: ServerConfigs.DATABASE_USERNAME,
  password: ServerConfigs.DATABASE_PASSWORD,
  host: ServerConfigs.DATABASE_HOST,
  port: Number(ServerConfigs.DATABASE_PORT) || 5432,
  dialectOptions: useSSL
    ? {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    }
    : {},
  
  logging: false,
  define: {
    charset: "utf8mb4",
    underscored: true,
  },
});

const CouponInstance = couponModel(sequelize);
const ContestCouponInstance = contestCouponModel(sequelize);
const UserCouponInstance = userCouponModel(sequelize);

// UserCoupon belongs to Coupon (one user coupon references one coupon)
UserCouponInstance.belongsTo(CouponInstance, {
  foreignKey: "couponId",
  as: "coupon",
});

// Coupon has many UserCoupons (one coupon can be redeemed by many users over time, though only one active redemption)
CouponInstance.hasMany(UserCouponInstance, {
  foreignKey: "couponId",
  as: "userCoupons",
});

// ContestCoupon belongs to Coupon (one contest coupon references one coupon)
ContestCouponInstance.belongsTo(CouponInstance, {
  foreignKey: "couponId",
  as: "coupon",
});

// Coupon has one ContestCoupon (one coupon belongs to only one contest)
CouponInstance.hasOne(ContestCouponInstance, {
  foreignKey: "couponId",
  as: "contestCoupon",
});

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
  Coupon: CouponInstance,
  ContestCoupon: ContestCouponInstance,
  UserCoupon: UserCouponInstance,
};
