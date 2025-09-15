import { logger } from "@repo/common";
import { Sequelize } from "sequelize";
import matchModel, { Match } from "../models/match.model";
import tournamentModel, { Tournament } from "../models/tournament.model";
import ServerConfigs from "./server.config";

export interface IDatabase {
  Sequelize: any;
  sequelize: Sequelize;
  Match: typeof Match;
  Tournament: typeof Tournament;
}

const sequelize = new Sequelize({
  dialect: "postgres",
  database: ServerConfigs.DATABASE_NAME,
  username: ServerConfigs.DATABASE_USERNAME,
  password: ServerConfigs.DATABASE_PASSWORD,
  host: ServerConfigs.DATABASE_HOST,
  port: Number(ServerConfigs.DATABASE_PORT) || 5432,
  dialectOptions: {},
  logging: console.log,
  define: {
    charset: "utf8mb4",
    underscored: true,
  },
});

const MatchInstance = matchModel(sequelize);
const TournamentInstance = tournamentModel(sequelize);

export async function connectDatabase() {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    logger.info("Database connection established ✅");
  } catch (error: any) {
    logger.error(`Error connecting database: ${error} `);
  }
}

// associations declared here
TournamentInstance.hasMany(MatchInstance, {
  foreignKey: "tournamentKey",
  sourceKey: "key",
  as: "matches",
});

MatchInstance.belongsTo(Tournament, {
  foreignKey: "tournamentKey",
  targetKey: "key",
  as: "tournaments",
});

export const DB: IDatabase = {
  Sequelize,
  sequelize,
  Match: MatchInstance,
  Tournament: TournamentInstance,
};
