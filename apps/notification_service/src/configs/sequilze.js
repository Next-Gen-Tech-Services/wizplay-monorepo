"use strict";

const path = require("path");
const dotenv = require("dotenv");
// Load environment variables
dotenv.config({
  path: `.env.${process.env.NODE_ENV || "development"}`,
});


const useSSL = process.env.DB_SSL === "true";
module.exports = {
  username: process.env.NOTIFICATION_DATABASE_USERNAME || "postgres",
  password: process.env.NOTIFICATION_DATABASE_PASSWORD || "notification_db",
  database: process.env.NOTIFICATION_DATABASE_NAME || "notification_service",
  host: process.env.NOTIFICATION_DATABASE_HOST || "localhost",
  port: process.env.NOTIFICATION_DATABASE_PORT || 5432,
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
