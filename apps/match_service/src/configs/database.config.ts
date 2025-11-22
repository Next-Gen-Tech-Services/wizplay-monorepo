import { logger } from "@repo/common";
import { Sequelize } from "sequelize";
import matchModel, { Match } from "../models/match.model";
import tournamentModel, { Tournament } from "../models/tournament.model";
import wishlistModel, { Wishlist } from "../models/wishlist.model";
import matchLiveStateModel, { MatchLiveState } from "../models/matchLiveState.model";
import matchLiveEventModel, { MatchLiveEvent } from "../models/matchLiveEvent.model";
import liveMatchDataModel, { LiveMatchData } from "../models/liveMatchData.model";
import ServerConfigs from "./server.config";

export interface IDatabase {
  Sequelize: any;
  sequelize: Sequelize;
  Match: typeof Match;
  Tournament: typeof Tournament;
  Wishlist: typeof Wishlist;
  MatchLiveState: typeof MatchLiveState;
  MatchLiveEvent: typeof MatchLiveEvent;
  LiveMatchData: typeof LiveMatchData;
}

const sequelize = new Sequelize({
  dialect: "postgres",
  database: ServerConfigs.DATABASE_NAME,
  username: ServerConfigs.DATABASE_USERNAME,
  password: ServerConfigs.DATABASE_PASSWORD,
  host: ServerConfigs.DATABASE_HOST,
  port: Number(ServerConfigs.DATABASE_PORT) || 5432,
  dialectOptions: {
    ssl: {
      require: false,
      rejectUnauthorized: false,
    },
  },
  logging: false,
  define: {
    charset: "utf8mb4",
    underscored: true,
  },
});

const MatchInstance = matchModel(sequelize);
const TournamentInstance = tournamentModel(sequelize);
const WishlistInstance = wishlistModel(sequelize);
const MatchLiveStateInstance = matchLiveStateModel(sequelize);
const MatchLiveEventInstance = matchLiveEventModel(sequelize);
const LiveMatchDataInstance = liveMatchDataModel(sequelize);

export async function connectDatabase() {
  try {
    await sequelize.authenticate();
    // Only sync on first run or when explicitly needed
    // Use migrations for production instead of sync
    if (ServerConfigs.DB_SYNC === 'true') {
      await sequelize.sync({ force: true });
      logger.info("Database synced ✅");
    }
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

// Live match associations
MatchLiveStateInstance.belongsTo(MatchInstance, {
  foreignKey: "matchId",
  // live state stores the external match key (string) not the internal UUID id
  // so target the Match 'key' attribute which is a string
  targetKey: "key",
  as: "match",
});

MatchLiveEventInstance.belongsTo(MatchInstance, {
  foreignKey: "matchId",
  // live events reference the match 'key' (string)
  targetKey: "key",
  as: "match",
});

export const DB: IDatabase = {
  Sequelize,
  sequelize,
  Match: MatchInstance,
  Tournament: TournamentInstance,
  Wishlist: WishlistInstance,
  MatchLiveState: MatchLiveStateInstance,
  MatchLiveEvent: MatchLiveEventInstance,
  LiveMatchData: LiveMatchDataInstance,
};
