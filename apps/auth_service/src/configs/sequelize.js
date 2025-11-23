"use strict";

const path = require("path");
const dotenv = require("dotenv");
// Load environment variables
dotenv.config({
  path: `.env.${process.env.NODE_ENV || "development"}`,
});

const useSSL = process.env.DB_SSL === "true";


module.exports = {
  username: process.env.AUTH_DATABASE_USERNAME || "postgres",
  password: process.env.AUTH_DATABASE_PASSWORD || "auth_db",
  database: process.env.AUTH_DATABASE_NAME || "auth_service",
  host: process.env.AUTH_DATABASE_HOST || "localhost",
  port: process.env.AUTH_DATABASE_PORT || 5434,
  dialect: "postgres",
  dialectOptions: useSSL
    ? {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    }
    : {},
  define: {
    timestamps: true,
    underscored: true,
  },
};
