"use strict";

const path = require("path");

// Try to load server.config.js or server.config.cjs
let ServerConfigs = {};
try {
  ServerConfigs = require("./server.config");
} catch (err) {
  console.warn("⚠ server.config.js not found, using defaults");
}

module.exports = {
  username: ServerConfigs.DATABASE_USERNAME || "user_db",
  password: ServerConfigs.DATABASE_PASSWORD || "user_db",
  database: ServerConfigs.DATABASE_NAME || "user_service",
  host: ServerConfigs.DATABASE_HOST || "localhost",
  port: ServerConfigs.DATABASE_PORT || 5436,
  dialect: "postgres",
};
