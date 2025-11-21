const dotenv = require("dotenv");

dotenv.config({
  path: `.env.${process.env.NODE_ENV? process.env.NODE_ENV : "development"}`,
});

const ServerConfigs = {
  NODE_ENV: process.env.NODE_ENV || "development",
  APP_PORT: process.env.AUTH_SERVICE_PORT,
  TOKEN_SECRET: process.env.TOKEN_SECRET,
  LOG_LEVEL: process.env.LOG_LEVEL,
  API_VERSION: process.env.API_VERSION,

  DATABASE_NAME: process.env.AUTH_DATABASE_NAME,
  DATABASE_USERNAME: process.env.AUTH_DATABASE_USERNAME,
  DATABASE_PASSWORD: process.env.AUTH_DATABASE_PASSWORD,
  DATABASE_HOST: process.env.AUTH_DATABASE_HOST,
  DATABASE_PORT: process.env.AUTH_DATABASE_PORT,
  DB_SYNC: process.env.DB_SYNC,

  REDIS_USERNAME: process.env.REDIS_USERNAME,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  REDIS_HOST: process.env.REDIS_HOST,
  REDIS_PORT: process.env.REDIS_PORT,

  RABBITMQ_URL: process.env.RABBITMQ_URL,

  KAF_CLIENT_ID:
    process.env.AUTH_KAF_CLIENT_ID || process.env.KAF_CLIENT_ID,
  KAF_GROUP_ID:
    process.env.AUTH_KAF_GROUP_ID || process.env.KAF_GROUP_ID,
  KAF_BROKERS: process.env.KAF_BROKERS,

  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,

  CLIENT_HOST: process.env.CLIENT_HOST,

  MSG91_BASE_URL: process.env.MSG91_BASE_URL,
  MSG91_AUTH_KEY: process.env.MSG91_AUTH_KEY,
  MSG91_TEMPLATE_ID: process.env.MSG91_TEMPLATE_ID,

  GOOGLE_IOS_CLIENT_ID: process.env.GOOGLE_IOS_CLIENT_ID,
  GOOGLE_ANDROID_CLIENT_ID: process.env.GOOGLE_ANDROID_CLIENT_ID,
};

module.exports = ServerConfigs;
