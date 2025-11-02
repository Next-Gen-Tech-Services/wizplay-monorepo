import ServerConfigs from "./server.config";
const sequelizeConfig = {
  username: ServerConfigs.DATABASE_USERNAME || "contest_db",
  password: ServerConfigs.DATABASE_PASSWORD || "contest_db",
  database: ServerConfigs.DATABASE_NAME || "contest_service",
  host: ServerConfigs.DATABASE_HOST || "localhost",
  port: ServerConfigs.DATABASE_PORT || 5438,
  dialect: "postgres",
};

export default sequelizeConfig;
