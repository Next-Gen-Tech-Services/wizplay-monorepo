import ServerConfigs from "./server.config";
const sequelizeConfig = {
  username: ServerConfigs.DATABASE_USERNAME || "auth_db",
  password: ServerConfigs.DATABASE_PASSWORD || "auth_db",
  database: ServerConfigs.DATABASE_NAME || "auth_service",
  host: ServerConfigs.DATABASE_HOST || "localhost",
  port: ServerConfigs.DATABASE_PORT || 5434,
  dialect: "postgres",
};

export default sequelizeConfig;
