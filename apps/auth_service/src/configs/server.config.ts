import dotenv from "dotenv";

dotenv.config({
  path: `.env.${process.env.NODE_ENV}`,
});

class ServerConfigs {
  static NODE_ENV: string = process.env.NODE_ENV as string;
  static APP_PORT: string = process.env.APP_PORT as string;
  static TOKEN_SECRET: string = process.env.TOKEN_SECRET as string;
  static LOG_LEVEL: string = process.env.LOG_LEVEL as string;
  static API_VERSION: string = process.env.API_VERSION as string;
  static DATABASE_NAME: string = process.env.DATABASE_NAME as string;
  static DATABASE_USERNAME: string = process.env.DATABASE_USERNAME as string;
  static DATABASE_PASSWORD: string = process.env.DATABASE_PASSWORD as string;
  static DATABASE_HOST: string = process.env.DATABASE_HOST as string;
  static DATABASE_PORT: string = process.env.DATABASE_PORT as string;
  static REDIS_USERNAME: string = process.env.REDIS_USERNAME as string;
  static REDIS_PASSWORD: string = process.env.REDIS_PASSWORD as string;
  static REDIS_HOST: string = process.env.REDIS_HOST as string;
  static REDIS_PORT: string = process.env.REDIS_PORT as string;
  static RABBITMQ_URL: string = process.env.RABBITMQ_URL as string;
  static KAF_CLIENT_ID: string = process.env.KAF_CLIENT_ID as string;
  static KAF_GROUP_ID: string = process.env.KAF_GROUP_ID as string;
  static KAF_BROKERS: string = process.env.KAF_BROKERS as string;
  static SMPT_USER: string = process.env.SMPT_USER as string;
  static SMPT_PASS: string = process.env.SMPT_PASS as string;
  static SMTP_HOST: string = process.env.SMTP_HOST as string;
  static SMPT_PORT: string = process.env.SMPT_PORT as string;
  static CLIENT_HOST: string = process.env.CLIENT_HOST as string;
  private constructor() {}
}

export default ServerConfigs;
