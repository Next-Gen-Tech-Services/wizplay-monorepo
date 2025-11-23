"use strict";

const path = require("path");
const dotenv = require("dotenv");
// Load environment variables
dotenv.config({
  path: `.env.${process.env.NODE_ENV || "development"}`,
});

const useSSL = process.env.DB_SSL === "true";


module.exports = {
  username: process.env.MATCH_DATABASE_USERNAME || "postgres",
  password: process.env.MATCH_DATABASE_PASSWORD || "match_db",
  database: process.env.MATCH_DATABASE_NAME || "match_service",
  host: process.env.MATCH_DATABASE_HOST || "localhost",
  port: process.env.MATCH_DATABASE_PORT || 5435,
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
