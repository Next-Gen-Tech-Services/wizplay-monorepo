"use strict";

const path = require("path");
const dotenv = require("dotenv");
// Load environment variables
dotenv.config({
  path: `.env.${process.env.NODE_ENV || "development"}`,
});

const useSSL = process.env.DB_SSL === "true";

module.exports = {
  username: process.env.USER_DATABASE_USERNAME || "postgres",
  password: process.env.USER_DATABASE_PASSWORD || "user_db",
  database: process.env.USER_DATABASE_NAME || "user_service",
  host: process.env.USER_DATABASE_HOST || "localhost",
  port: process.env.USER_DATABASE_PORT || 5436,
  dialect: "postgres",
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
};
