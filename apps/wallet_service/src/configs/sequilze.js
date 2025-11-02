import ServerConfigs from "./server.config";
const sequelizeConfig = {
  username: ServerConfigs.DATABASE_USERNAME || "wallet_db",
  password: ServerConfigs.DATABASE_PASSWORD || "wallet_db",
  database: ServerConfigs.DATABASE_NAME || "wallet_service",
  host: ServerConfigs.DATABASE_HOST || "localhost",
  port: ServerConfigs.DATABASE_PORT || 5439,
  dialect: "postgres",
};

export default sequelizeConfig;
