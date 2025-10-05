import { DataTypes, Model, Optional, Sequelize, UUIDV4 } from "sequelize";
import { IUserContestAttributes } from "../dtos/usercontest.dto";

interface UserContestCreationAttributes
  extends Optional<IUserContestAttributes, "id" | "createdAt" | "updatedAt"> {}

export class UserContest
  extends Model<IUserContestAttributes, UserContestCreationAttributes>
  implements IUserContestAttributes
{
  public id!: string;
  public userId!: string;
  public contestId!: string;
  public matchId!: string;
  public status!: "active" | "inactive";
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
        type: DataTypes.STRING,
        allowNull: false,
      },
      contestId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      matchId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("active", "inactive"),
        allowNull: false,
        defaultValue: "active",
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
