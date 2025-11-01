// src/configs/database.config.ts
import { logger } from "@repo/common";
import { Sequelize } from "sequelize";
import initContestModel, { Contest } from "../models/contest.model";
import initContestPrizeModel, {
  ContestPrize,
} from "../models/contestPrize.model";
import initQuestionModel, { Question } from "../models/question.model";
import initUserContestModel, { UserContest } from "../models/userContest.model";
import initUserSubmission, {
  UserSubmission,
} from "../models/userSubmission.model";
import ServerConfigs from "./server.config";

export interface IDatabase {
  Sequelize: typeof Sequelize;
  sequelize: Sequelize;
  Contest: typeof Contest;
  ContestPrize: typeof ContestPrize;
  Question: typeof Question;
  UserContest: typeof UserContest;
  UserSubmission: typeof UserSubmission;
}

const sequelize = new Sequelize({
  dialect: "postgres",
  database: ServerConfigs.DATABASE_NAME,
  username: ServerConfigs.DATABASE_USERNAME,
  password: ServerConfigs.DATABASE_PASSWORD,
  host: ServerConfigs.DATABASE_HOST,
  port: Number(ServerConfigs.DATABASE_PORT) || 5432,
  dialectOptions: {},
  logging: console.log, // or false in production
  define: {
    charset: "utf8mb4",
    underscored: true,
  },
});

// initialize models
const ContestInstance = initContestModel(sequelize);
const QuestionInstance = initQuestionModel(sequelize);
const UserContestInstance = initUserContestModel(sequelize);
const UserSubmissionInstance = initUserSubmission(sequelize);
const ContestPrizeInstance = initContestPrizeModel(sequelize);
UserSubmissionInstance.belongsTo(QuestionInstance, {
  foreignKey: "questionId",
  as: "question",
});
QuestionInstance.hasMany(UserSubmissionInstance, {
  foreignKey: "questionId",
  as: "answers",
});
// associations (optional but useful)
ContestInstance.hasMany(QuestionInstance, {
  foreignKey: "contest_id", // use the DB column name if your model maps field -> underscored
  as: "questions",
});

QuestionInstance.belongsTo(ContestInstance, {
  foreignKey: "contest_id",
  as: "contest",
});

ContestInstance.hasMany(UserContestInstance, {
  foreignKey: "contest_id",
  as: "userContests",
});

ContestInstance.hasMany(UserContestInstance, {
  foreignKey: "contest_id",
  as: "userJoins",
});

UserContestInstance.belongsTo(ContestInstance, {
  foreignKey: "contest_id",
  as: "contest", // single belongsTo alias used by find/include
});

export async function connectDatabase() {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    logger.info("Database connection established ✅");
  } catch (error: any) {
    logger.error(`Error connecting database: ${error.message ?? error}`);
    throw error;
  }
}

export const DB: IDatabase = {
  Sequelize,
  sequelize: sequelize,
  Contest: ContestInstance,
  ContestPrize: ContestPrizeInstance,
  Question: QuestionInstance,
  UserContest: UserContestInstance,
  UserSubmission: UserSubmissionInstance,
};
