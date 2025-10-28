import { logger } from "@repo/common";
import { Sequelize } from "sequelize";
import contestCouponModel, {
  ContestCoupon,
} from "../models/contestCoupon.model";
import couponModel, { Coupon } from "../models/coupon.model";
import ServerConfigs from "./server.config";

export interface IDatabase {
  Sequelize: any;
  sequelize: Sequelize;
  Coupon: typeof Coupon;
  ContestCoupon: typeof ContestCoupon;
}

const sequelize = new Sequelize({
  dialect: "postgres",
  database: ServerConfigs.DATABASE_NAME,
  username: ServerConfigs.DATABASE_USERNAME,
  password: ServerConfigs.DATABASE_PASSWORD,
  host: ServerConfigs.DATABASE_HOST,
  port: Number(ServerConfigs.DATABASE_PORT) || 5432,
  dialectOptions: {},
  logging: console.log,
  define: {
    charset: "utf8mb4",
    underscored: true,
  },
});

const CouponInstance = couponModel(sequelize);
const ContestCouponInstance = contestCouponModel(sequelize);

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
    await sequelize.sync({ alter: true });
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
};
