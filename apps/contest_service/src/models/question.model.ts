// src/models/question.model.ts
import { DataTypes, Model, Optional, Sequelize, UUIDV4 } from "sequelize";

export interface IQuestionAttrs {
  id: string;
  contestId: string;
  matchId: string;
  question: string;
  options: any[];
  ansKey?: string;
  points?: number;
  displayOnFrontend?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface QuestionCreationAttributes
  extends Optional<
    IQuestionAttrs,
    "id" | "points" | "ansKey" | "createdAt" | "updatedAt"
  > {}

export class Question
  extends Model<IQuestionAttrs, QuestionCreationAttributes>
  implements IQuestionAttrs
{
  public id!: string;
  public contestId!: string;
  public matchId!: string;
  public question!: string;
  public options!: any[];
  public ansKey: string;
  public points!: number | undefined;
  public displayOnFrontend?: boolean;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;
}

export default function (sequelize: Sequelize) {
  Question.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: UUIDV4,
      },
      contestId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      matchId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      question: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      options: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      ansKey: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
      },
      points: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      displayOnFrontend: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: "Question",
      tableName: "questions",
      timestamps: true,
      underscored: true,
    }
  );

  return Question;
}
