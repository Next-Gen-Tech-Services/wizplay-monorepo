import { DataTypes, Model, Optional, Sequelize, UUIDV4 } from "sequelize";

export interface IContestReminderAttributes {
  id: string;
  userId: string;
  contestId: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ContestReminderCreationAttributes
  extends Optional<IContestReminderAttributes, "id" | "createdAt" | "updatedAt"> {}

export class ContestReminder
  extends Model<IContestReminderAttributes, ContestReminderCreationAttributes>
  implements IContestReminderAttributes
{
  public id!: string;
  public userId!: string;
  public contestId!: string;
  public isActive!: boolean;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;
}

export default function (sequelize: Sequelize) {
  ContestReminder.init(
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
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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
      modelName: "ContestReminder",
      tableName: "contest_reminders",
      timestamps: true,
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ["user_id", "contest_id"],
        },
        {
          fields: ["user_id"],
        },
        {
          fields: ["contest_id"],
        },
        {
          fields: ["is_active"],
          where: {
            is_active: true,
          },
        },
      ],
    }
  );

  return ContestReminder;
}
