// Sequelize configuration - reads from environment variables
import { config } from "dotenv";

const envFile = `.env.${process.env.NODE_ENV || "development"}`;
config({ path: envFile });

// Single configuration object that reads from .env files
const sequelizeConfig = {
  username: process.env.AUTH_DATABASE_USERNAME || "auth_db",
  password: process.env.AUTH_DATABASE_PASSWORD || "auth_db",
  database: process.env.AUTH_DATABASE_NAME || "auth_service",
  host: process.env.AUTH_DATABASE_HOST || "localhost",
  port: process.env.AUTH_DATABASE_PORT || 5434,
  dialect: "postgres",
};

export default sequelizeConfig;
