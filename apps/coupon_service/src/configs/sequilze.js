import ServerConfigs from "./server.config";
const sequelizeConfig = {
  username: ServerConfigs.DATABASE_USERNAME || "coupon_db",
  password: ServerConfigs.DATABASE_PASSWORD || "coupon_db",
  database: ServerConfigs.DATABASE_NAME || "coupon_service",
  host: ServerConfigs.DATABASE_HOST || "localhost",
  port: ServerConfigs.DATABASE_PORT || 5437,
  dialect: "postgres",
};

export default sequelizeConfig;
