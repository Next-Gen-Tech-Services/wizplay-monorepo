// src/configs/database.config.ts
import { logger } from "@repo/common";
import { Sequelize } from "sequelize";
import initContestModel, { Contest } from "../models/contest.model";
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

// associations (optional but useful)
ContestInstance.hasMany(QuestionInstance, {
  foreignKey: "contestId",
  as: "questions",
});

QuestionInstance.belongsTo(ContestInstance, {
  foreignKey: "contestId",
  as: "contest",
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
  Question: QuestionInstance,
  UserContest: UserContestInstance,
  UserSubmission: UserSubmissionInstance,
};
