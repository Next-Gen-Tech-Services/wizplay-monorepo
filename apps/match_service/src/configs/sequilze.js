import ServerConfigs from "./server.config";
const sequelizeConfig = {
  username: ServerConfigs.DATABASE_USERNAME || "match_db",
  password: ServerConfigs.DATABASE_PASSWORD || "match_db",
  database: ServerConfigs.DATABASE_NAME || "match_service",
  host: ServerConfigs.DATABASE_HOST || "localhost",
  port: ServerConfigs.DATABASE_PORT || 5435,
  dialect: "postgres",
};

export default sequelizeConfig;
