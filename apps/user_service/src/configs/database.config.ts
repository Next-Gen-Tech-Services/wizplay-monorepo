import { logger } from "@repo/common";
import { Sequelize } from "sequelize";
import ServerConfigs from "./server.config";

const sequelize = new Sequelize({
  dialect: "postgres",
  database: ServerConfigs.DATABASE_NAME,
  username: ServerConfigs.DATABASE_USERNAME,
  password: ServerConfigs.DATABASE_PASSWORD,
  host: ServerConfigs.DATABASE_HOST,
  port: Number(ServerConfigs.DATABASE_PORT) || 5432,
  dialectOptions: {},
  logging: console.log,
});

async function connectDatabase() {
  try {
    await sequelize.authenticate()
    logger.info("Database connection established ✅");
  } catch (error: any) {
    logger.error(`Error connecting database: ${error} `)
  }
}

export default connectDatabase;