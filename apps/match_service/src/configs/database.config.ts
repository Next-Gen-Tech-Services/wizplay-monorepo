import { logger } from "@repo/common";
import { Sequelize } from "sequelize";
import matchModel, { Match } from "../models/match.model";
import tournamentModel, { Tournament } from "../models/tournament.model";
import wishlistModel, { Wishlist } from "../models/wishlist.model";
import ServerConfigs from "./server.config";

export interface IDatabase {
  Sequelize: any;
  sequelize: Sequelize;
  Match: typeof Match;
  Tournament: typeof Tournament;
  Wishlist: typeof Wishlist;
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
const WishlistInstance = wishlistModel(sequelize);

export async function connectDatabase() {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ force: true });
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

MatchInstance.belongsTo(TournamentInstance, {
  foreignKey: "tournamentKey",
  targetKey: "key",
  as: "tournaments",
});

MatchInstance.hasMany(WishlistInstance, {
  foreignKey: "matchId",
  sourceKey: "id",
  as: "wishlists",
});

WishlistInstance.belongsTo(MatchInstance, {
  foreignKey: "matchId",
  targetKey: "id",
  as: "match",
});

export const DB: IDatabase = {
  Sequelize,
  sequelize,
  Match: MatchInstance,
  Tournament: TournamentInstance,
  Wishlist: WishlistInstance,
};
