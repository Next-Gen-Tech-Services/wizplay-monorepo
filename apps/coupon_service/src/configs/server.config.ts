import dotenv from "dotenv";
dotenv.config({
  path: `.env.${process.env.NODE_ENV}`,
});

class ServerConfigs {
  static NODE_ENV: string = process.env.NODE_ENV as string;
  static APP_PORT: string = process.env.COUPON_SERVICE_PORT as string;
  static LOG_LEVEL: string = process.env.LOG_LEVEL as string;
  static API_VERSION: string = process.env.API_VERSION as string;
  static DATABASE_NAME: string = process.env.COUPON_DATABASE_NAME as string;
  static DATABASE_USERNAME: string = process.env
    .COUPON_DATABASE_USERNAME as string;
  static DATABASE_PASSWORD: string = process.env
    .COUPON_DATABASE_PASSWORD as string;
  static DATABASE_HOST: string = process.env.COUPON_DATABASE_HOST as string;
  static DATABASE_PORT: string = process.env.COUPON_DATABASE_PORT as string;
  static DB_SYNC: string = process.env.DB_SYNC as string;
  static REDIS_USERNAME: string = process.env.REDIS_USERNAME as string;
  static REDIS_PASSWORD: string = process.env.REDIS_PASSWORD as string;
  static REDIS_HOST: string = process.env.REDIS_HOST as string;
  static REDIS_PORT: string = process.env.REDIS_PORT as string;
  static RABBITMQ_URL: string = process.env.RABBITMQ_URL as string;
  static KAF_CLIENT_ID: string = process.env.COUPON_KAF_CLIENT_ID || process.env.KAF_CLIENT_ID as string;
  static KAF_GROUP_ID: string = process.env.COUPON_KAF_GROUP_ID || process.env.KAF_GROUP_ID as string;
  static KAF_BROKERS: string = process.env.KAF_BROKERS as string;
  static SMTP_USER: string = process.env.SMTP_USER as string;
  static SMTP_PASS: string = process.env.SMTP_PASS as string;
  static SMTP_HOST: string = process.env.SMTP_HOST as string;
  static SMTP_PORT: string = process.env.SMTP_PORT as string;
  static DB_SSL: string = process.env.DB_SSL as string;
  static WALLET_SERVICE_URL: string = process.env.WALLET_SERVICE_URL as string;
  static NOTIFICATION_SERVICE_URL: string = process.env.NOTIFICATION_SERVICE_URL as string;

  private constructor() {}
}

export default ServerConfigs;
