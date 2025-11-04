// src/configs/database.config.ts
import { logger } from "@repo/common";
import { Sequelize } from "sequelize";
import initNotificationModel, { Notification } from "../models/notification.model";
import ServerConfigs from "./server.config";

export interface IDatabase {
  Sequelize: typeof Sequelize;
  sequelize: Sequelize;
  Notification: typeof Notification;
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

// Initialize models
const NotificationInstance = initNotificationModel(sequelize);

export async function connectDatabase() {
  try {
    await sequelize.authenticate();
    if (ServerConfigs.DB_SYNC === "true") {
      await sequelize.sync({ alter: true });
      logger.info("Database synced ✅");
    }
    logger.info("Database connection established ✅");
  } catch (error: any) {
    logger.error(`Error connecting database: ${error.message ?? error}`);
    throw error;
  }
}

// Alias for consistency with other services
export const connectDB = connectDatabase;

export const DB: IDatabase = {
  Sequelize,
  sequelize: sequelize,
  Notification: NotificationInstance,
};
