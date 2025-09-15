// src/models/question.model.ts
import { DataTypes, Model, Optional, Sequelize, UUIDV4 } from "sequelize";

export interface IQuestionAttrs {
  id: string;
  contestId: string;
  text: string;
  options: string[]; // stored as JSON
  correctIndex: number;
  points?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface QuestionCreationAttributes
  extends Optional<
    IQuestionAttrs,
    "id" | "points" | "createdAt" | "updatedAt"
  > {}

export class Question
  extends Model<IQuestionAttrs, QuestionCreationAttributes>
  implements IQuestionAttrs
{
  public id!: string;
  public contestId!: string;
  public text!: string;
  public options!: string[];
  public correctIndex!: number;
  public points!: number | undefined;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;
}

export default function initQuestionModel(sequelize: Sequelize) {
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
      text: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      options: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      correctIndex: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      points: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
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
