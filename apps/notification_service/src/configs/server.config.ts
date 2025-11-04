// src/configs/server.config.ts
import dotenv from "dotenv";

dotenv.config({
  path: `.env.${process.env.NODE_ENV}`,
});

class ServerConfigs {
  static NODE_ENV: string = process.env.NODE_ENV as string;
  static APP_PORT: string = process.env.NOTIFICATION_SERVICE_PORT || "4006";
  static TOKEN_SECRET: string = process.env.TOKEN_SECRET as string;
  static API_VERSION: string = process.env.API_VERSION || "v1";
  
  // Database
  static DATABASE_NAME: string = process.env.NOTIFICATION_DATABASE_NAME as string;
  static DATABASE_USERNAME: string = process.env.NOTIFICATION_DATABASE_USERNAME as string;
  static DATABASE_PASSWORD: string = process.env.NOTIFICATION_DATABASE_PASSWORD as string;
  static DATABASE_HOST: string = process.env.NOTIFICATION_DATABASE_HOST as string;
  static DATABASE_PORT: string = process.env.NOTIFICATION_DATABASE_PORT || "5432";
  static DB_SYNC: string = process.env.DB_SYNC || "false";
  
  // Redis
  static REDIS_USERNAME: string = process.env.REDIS_USERNAME as string;
  static REDIS_PASSWORD: string = process.env.REDIS_PASSWORD as string;
  static REDIS_HOST: string = process.env.REDIS_HOST as string;
  static REDIS_PORT: string = process.env.REDIS_PORT as string;
  
  // Kafka
  static KAF_CLIENT_ID: string = process.env.KAF_CLIENT_ID as string;
  static KAF_GROUP_ID: string = process.env.KAF_GROUP_ID || "notification-group";
  static KAF_BROKERS: string = process.env.KAF_BROKERS as string;
  
  // Firebase
  static FIREBASE_PROJECT_ID: string = process.env.FIREBASE_PROJECT_ID as string;
  static FIREBASE_PRIVATE_KEY: string = process.env.FIREBASE_PRIVATE_KEY as string;
  static FIREBASE_CLIENT_EMAIL: string = process.env.FIREBASE_CLIENT_EMAIL as string;
  
  // Other services
  static USER_SERVICE_URL: string = process.env.USER_SERVICE_URL || "http://localhost:4002";
  
  private constructor() {}
  
  static get PORT(): string {
    return this.APP_PORT;
  }
}

export default ServerConfigs;
export const serverConfig = ServerConfigs;
