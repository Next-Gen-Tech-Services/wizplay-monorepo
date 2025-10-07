import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";

export interface IUserSubmissionAttrs {
  id: string;
  userId: string;
  contestId: string;
  totalScore: number;
  maxScore: number;
  answers: any; // JSON array of per-question details saved for audit
  createdAt?: Date;
  updatedAt?: Date;
}

export class UserSubmission
  extends Model<IUserSubmissionAttrs>
  implements IUserSubmissionAttrs
{
  public id!: string;
  public userId!: string;
  public contestId!: string;
  public totalScore!: number;
  public maxScore!: number;
  public answers!: any;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export default function (sequelize: Sequelize) {
  UserSubmission.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: UUIDV4 },
      userId: { type: DataTypes.STRING(128), allowNull: false },
      contestId: { type: DataTypes.UUID, allowNull: false },
      totalScore: { type: DataTypes.INTEGER, allowNull: false },
      maxScore: { type: DataTypes.INTEGER, allowNull: false },
      answers: { type: DataTypes.JSONB, allowNull: false }, // array: [{questionId, selectedKey, isCorrect, earnedPoints}]
    },
    {
      sequelize,
      modelName: "UserSubmission",
      tableName: "user_submissions",
      underscored: true,
      timestamps: true,
    }
  );

  return UserSubmission;
}
