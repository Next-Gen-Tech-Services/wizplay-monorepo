import { logger } from "@repo/common";
import { Sequelize } from "sequelize";
import authModel, { Auth } from "../models/auth.model";
import ServerConfigs from "./server.config";

export interface IDatabase {
  Sequelize: any;
  sequelize: Sequelize;
  Auth: typeof Auth;
}

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

const AuthInstance = authModel(sequelize);

export async function connectDatabase() {
  try {
    await sequelize.authenticate();
    if (ServerConfigs.DB_SYNC === "true") {
      await sequelize.sync({ alter: true });
      logger.info("Database synced ✅");
    }
    logger.info("Database connection established ✅");
  } catch (error: any) {
    logger.error(`Error connecting database: ${error}`);
  }
}

export const DB: IDatabase = {
  Sequelize,
  sequelize,
  Auth: AuthInstance,
};
