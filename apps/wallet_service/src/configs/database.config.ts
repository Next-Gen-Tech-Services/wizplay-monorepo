// src/configs/database.config.ts
import { logger } from "@repo/common";
import { Sequelize } from "sequelize";
import walletTransactionModel, {
  WalletTransaction,
} from "../models/transaction.model";
import walletModel, { Wallet } from "../models/wallet.model";
import ServerConfigs from "./server.config";

export interface IDatabase {
  Sequelize: typeof Sequelize;
  sequelize: Sequelize;
  Wallet: typeof Wallet;
  Transaction: typeof WalletTransaction;
}

const sequelize = new Sequelize({
  dialect: "postgres",
  database: ServerConfigs.DATABASE_NAME,
  username: ServerConfigs.DATABASE_USERNAME,
  password: ServerConfigs.DATABASE_PASSWORD,
  host: ServerConfigs.DATABASE_HOST,
  port: Number(ServerConfigs.DATABASE_PORT) || 5432,
  dialectOptions: {},
  logging: false, // or false in production
  define: {
    charset: "utf8mb4",
    underscored: true,
  },
});

// initialize models
const WalletInstance = walletModel(sequelize);
const WalletTransactionInstance = walletTransactionModel(sequelize);

// associations (optional but useful)
WalletInstance.hasMany(WalletTransactionInstance, {
  foreignKey: "walletId",
  as: "transactions",
});

WalletTransactionInstance.belongsTo(WalletInstance, {
  foreignKey: "walletId",
  as: "wallet",
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
    logger.error(`Error connecting database: ${error.message ?? error}`);
    throw error;
  }
}

export const DB: IDatabase = {
  Sequelize,
  sequelize,
  Wallet: WalletInstance,
  Transaction: WalletTransactionInstance,
};
