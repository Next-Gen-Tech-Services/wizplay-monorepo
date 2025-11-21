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
  username: ServerConfigs.DATABASE_USERNAME || "auth_db",
  password: ServerConfigs.DATABASE_PASSWORD || "auth_db",
  database: ServerConfigs.DATABASE_NAME || "auth_service",
  host: ServerConfigs.DATABASE_HOST || "localhost",
  port: ServerConfigs.DATABASE_PORT || 5434,
  dialect: "postgres",
};
