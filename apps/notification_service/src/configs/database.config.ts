import { logger } from "@repo/common";
import { Sequelize } from "sequelize";
import notificationModel, { Notification } from "../models/notification.model";
import ServerConfigs from "./server.config";

export interface IDatabase {
  Sequelize: any;
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

const NotificationInstance = notificationModel(sequelize);

export async function connectDatabase() {
  try {
    await sequelize.authenticate();
    // Only sync on first run or when explicitly needed
    // Use migrations for production instead of sync
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
  Notification: NotificationInstance,
};
