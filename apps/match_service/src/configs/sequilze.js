// /server/src/configs/database-config.ts
import { config } from "dotenv";

const envFile = `.env.${process.env.NODE_ENV || "development"}`;
config({ path: envFile });

export const development = {
  username: process.env.DB_USERNAME || "your_username",
  password: process.env.DB_PASSWORD || "your_password",
  database: process.env.DB_NAME || "your_database",
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  dialect: "postgres",
};
export const test = {
  username: process.env.DB_USERNAME || "your_username",
  password: process.env.DB_PASSWORD || "your_password",
  database: process.env.DB_NAME || "your_test_database",
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  dialect: "postgres",
};
export const production = {
  username: process.env.DB_USERNAME || "your_username",
  password: process.env.DB_PASSWORD || "your_password",
  database: process.env.DB_NAME || "your_production_database",
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  dialect: "postgres",
};
