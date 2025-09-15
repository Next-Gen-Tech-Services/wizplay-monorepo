// src/models/contest.model.ts
import { DataTypes, Model, Optional, Sequelize, UUIDV4 } from "sequelize";

export type ContestStatus = "scheduled" | "running" | "completed" | "cancelled";

export interface IContestAttrs {
  id: string;
  matchId: string; // reference to match-service match id
  name: string;
  description?: string | null;
  startAt?: number | null; // unix seconds
  endAt?: number | null;
  maxParticipants?: number | null;
  entryFee?: number | null;
  prizePool?: number | null;
  platform?: string | null;
  status: ContestStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ContestCreationAttributes
  extends Optional<
    IContestAttrs,
    | "id"
    | "createdAt"
    | "updatedAt"
    | "description"
    | "startAt"
    | "endAt"
    | "maxParticipants"
    | "entryFee"
    | "prizePool"
    | "platform"
  > {}

export class Contest
  extends Model<IContestAttrs, ContestCreationAttributes>
  implements IContestAttrs
{
  public id!: string;
  public matchId!: string;
  public name!: string;
  public description!: string | null;
  public startAt!: number | null;
  public endAt!: number | null;
  public maxParticipants!: number | null;
  public entryFee!: number | null;
  public prizePool!: number | null;
  public platform!: string | null;
  public status!: ContestStatus;

  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;
}

export default function initContestModel(sequelize: Sequelize) {
  Contest.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: UUIDV4,
      },
      matchId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
      },
      startAt: {
        type: DataTypes.INTEGER, // unix seconds
        allowNull: true,
        defaultValue: null,
      },
      endAt: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      maxParticipants: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      entryFee: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      prizePool: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      platform: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: null,
      },
      status: {
        type: DataTypes.ENUM("scheduled", "running", "completed", "cancelled"),
        allowNull: false,
        defaultValue: "scheduled",
      },
    },
    {
      sequelize,
      modelName: "Contest",
      tableName: "contests",
      timestamps: true,
      underscored: true,
    }
  );

  return Contest;
}
