"use strict";

const path = require("path");
const dotenv = require("dotenv");
// Load environment variables
dotenv.config({
  path: `.env.${process.env.NODE_ENV || "development"}`,
});

const useSSL = process.env.DB_SSL === "true";


module.exports = {
  username: process.env.CONTEST_DATABASE_USERNAME || "postgres",
  password: process.env.CONTEST_DATABASE_PASSWORD || "contest_db",
  database: process.env.CONTEST_DATABASE_NAME || "contest_service",
  host: process.env.CONTEST_DATABASE_HOST || "localhost",
  port: process.env.CONTEST_DATABASE_PORT || 5438,
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
