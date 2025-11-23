"use strict";

const path = require("path");
const dotenv = require("dotenv");
// Load environment variables
dotenv.config({
  path: `.env.${process.env.NODE_ENV || "development"}`,
});

const useSSL = process.env.DB_SSL === "true";


module.exports = {
  username: process.env.COUPON_DATABASE_USERNAME || "postgres",
  password: process.env.COUPON_DATABASE_PASSWORD || "coupon_db",
  database: process.env.COUPON_DATABASE_NAME || "coupon_service",
  host: process.env.COUPON_DATABASE_HOST || "localhost",
  port: process.env.COUPON_DATABASE_PORT || 5437,
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
