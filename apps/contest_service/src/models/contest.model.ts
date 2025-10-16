// src/models/contest.model.ts
import { DataTypes, Model, Optional, Sequelize, UUIDV4 } from "sequelize";

export type ContestStatus = "scheduled" | "running" | "completed" | "cancelled";

export interface IContestAttrs {
  id: string;
  matchId?: string | null; // optional reference to match-service match id
  title: string;
  description?: string | null;

  // new fields
  type?: "pre-match" | "live" | "post-match" | string | null;
  difficulty?: "beginner" | "intermediate" | "expert" | string | null;

  startAt?: number | null; // unix seconds
  endAt?: number | null;

  entryFee?: number | null;
  prizePool?: number | null;
  prizeBreakdown?: any | null; // JSON object

  pointsPerQuestion?: number | null;
  questionsCount?: number | null;

  totalSpots?: number | null; // same as maxParticipants
  filledSpots?: number | null; // current joined participants

  displayEnabled?: boolean | null;
  isPopular?: boolean | null;

  joinDeadline?: "before_match" | "fixed_time" | string | null;
  resultTime?: "end_of_match" | "fixed_time" | string | null;

  timeCommitment?: string | null;
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
    | "totalSpots"
    | "filledSpots"
    | "entryFee"
    | "prizePool"
    | "prizeBreakdown"
    | "platform"
    | "type"
    | "difficulty"
    | "pointsPerQuestion"
    | "questionsCount"
    | "displayEnabled"
    | "isPopular"
    | "joinDeadline"
    | "resultTime"
    | "timeCommitment"
    | "matchId"
  > {}

export class Contest
  extends Model<IContestAttrs, ContestCreationAttributes>
  implements IContestAttrs
{
  public id!: string;
  public matchId!: string | null;
  public title!: string;
  public description!: string | null;

  public type!: "pre-match" | "live" | "post-match" | string | null;
  public difficulty!: "beginner" | "intermediate" | "expert" | string | null;

  public startAt!: number | null;
  public endAt!: number | null;

  public entryFee!: number | null;
  public prizePool!: number | null;
  public prizeBreakdown!: any | null;
  public pointsPerQuestion!: number | null;
  public questionsCount!: number | null;

  public totalSpots!: number | null;
  public filledSpots!: number | null;

  public displayEnabled!: boolean | null;
  public isPopular!: boolean | null;

  public joinDeadline!: "before_match" | "fixed_time" | string | null;
  public resultTime!: "end_of_match" | "fixed_time" | string | null;

  public timeCommitment!: string | null;
  public platform!: string | null;

  public status!: ContestStatus;

  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;
}

export default function (sequelize: Sequelize) {
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
        allowNull: true,
        defaultValue: null,
      },

      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },

      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
      },

      // new fields
      type: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: null,
      },

      difficulty: {
        type: DataTypes.STRING(50),
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
      prizeBreakdown: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: null,
        field: "prize_breakdown",
      },
      pointsPerQuestion: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },

      questionsCount: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },

      totalSpots: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },

      filledSpots: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },

      displayEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: true,
      },

      isPopular: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
      },

      joinDeadline: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: null,
      },

      resultTime: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: null,
      },

      timeCommitment: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: null,
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
      underscored: true, // keep DB columns snake_case while model uses camelCase
    }
  );

  return Contest;
}
