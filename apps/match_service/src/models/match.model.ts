import { DataTypes, Model, Optional, Sequelize } from "sequelize";
import { IMatchAttrs } from "../dtos/match.dto";

interface MatchCreationAttrs
  extends Optional<
    IMatchAttrs,
    | "id"
    | "createdAt"
    | "updatedAt"
    | "tournamentKey"
    | "subTitle"
    | "endedAt"
    | "expectedStartedAt"
  > {}

export class Match
  extends Model<IMatchAttrs, MatchCreationAttrs>
  implements IMatchAttrs
{
  subTitle: string | null;
  public id!: string;
  public key!: string;
  public sport!: string;
  public format!: string;
  public gender!: string;
  public tournamentKey?: string | null;
  public name!: string;
  public shortName!: string;
  public status!: string;
  public metricGroup!: string;
  public winner!: string;
  public startedAt!: number;
  public endedAt?: number | null;
  public expectedStartedAt?: number | null;
  public expectedEndedAt!: number;
  public showOnFrontend: boolean;
  public contestGenerated: boolean;

  public teams!: any; // JSONB

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}
export default function (sequelize: Sequelize) {
  Match.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      key: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
      },
      sport: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      format: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      gender: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      tournamentKey: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
        references: {
          model: "tournaments",
          key: "key",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      shortName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      metricGroup: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      winner: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
      },
      subTitle: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
      },
      startedAt: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      endedAt: {
        type: DataTypes.FLOAT,
        allowNull: true,
        defaultValue: null,
      },
      expectedStartedAt: {
        type: DataTypes.FLOAT,
        allowNull: true,
        defaultValue: null,
      },
      expectedEndedAt: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      teams: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      showOnFrontend: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      contestGenerated: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: "Match",
      timestamps: true,
      underscored: true,
    }
  );

  return Match;
}
