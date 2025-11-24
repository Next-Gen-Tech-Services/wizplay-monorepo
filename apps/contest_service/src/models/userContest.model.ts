import { DataTypes, Model, Optional, Sequelize, UUIDV4 } from "sequelize";
import { IUserContestAttributes } from "../dtos/usercontest.dto";

interface UserContestCreationAttributes
  extends Optional<IUserContestAttributes, "id" | "score" | "rank" | "createdAt" | "updatedAt"> {}

export class UserContest
  extends Model<IUserContestAttributes, UserContestCreationAttributes>
  implements IUserContestAttributes
{
  public id!: string;
  public userId!: string;
  public contestId!: string;
  public matchId!: string;
  public status!: "active" | "completed";
  public score?: number;
  public rank?: number;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;
}

export default function (sequelize: Sequelize) {
  UserContest.init(
    {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: UUIDV4,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      contestId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      matchId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("active", "completed"),
        allowNull: false,
        defaultValue: "active",
      },
      score: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      rank: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      modelName: "UserContest",
      timestamps: true,
      underscored: true,
    }
  );

  return UserContest;
}

