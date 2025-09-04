import { DataTypes, Model, Optional, Sequelize, UUIDV4 } from "sequelize";
import { IMatchAttrs } from "../dtos/match.dto";

type MatchCreation = Optional<
  IMatchAttrs,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "name"
  | "short_name"
  | "tournament_key"
  | "metric_group"
  | "format"
  | "venue_name"
  | "team_a"
  | "team_b"
  | "status"
  | "result_msg"
  | "start_at"
  | "raw_json"
  | "display_on_frontend"
  | "contests_generated"
  | "contests_updated_at"
>;

export class Match
  extends Model<IMatchAttrs, MatchCreation>
  implements IMatchAttrs
{
  public id!: string;
  public match_key!: string;
  public name?: string | null;
  public short_name?: string | null;

  public tournament_key?: string | null;
  public metric_group?: string | null;
  public format?: string | null;

  public venue_name?: string | null;

  public team_a?: string | null;
  public team_b?: string | null;

  public status?: string | null;
  public result_msg?: string | null;

  public start_at?: Date | null;
  public raw_json?: any | null;

  public display_on_frontend?: boolean;
  public contests_generated?: boolean;
  public contests_updated_at?: Date | null;

  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;
}

export default function (sequelize: Sequelize) {
  Match.init(
    {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: UUIDV4,
      },
      match_key: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      name: DataTypes.STRING,
      short_name: DataTypes.STRING,

      tournament_key: DataTypes.STRING,
      metric_group: DataTypes.STRING,
      format: DataTypes.STRING,

      venue_name: DataTypes.STRING,

      team_a: DataTypes.STRING,
      team_b: DataTypes.STRING,

      status: DataTypes.STRING,
      result_msg: DataTypes.STRING,

      start_at: DataTypes.DATE, // epoch seconds -> Date in seeder

      raw_json: DataTypes.JSONB,

      display_on_frontend: { type: DataTypes.BOOLEAN, defaultValue: false },
      contests_generated: { type: DataTypes.BOOLEAN, defaultValue: false },
      contests_updated_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: "Match",
      tableName: "matches",
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ["match_key"], unique: true, name: "idx_matches_match_key" },
        { fields: ["tournament_key"], name: "idx_matches_tournament_key" },
        { fields: ["status"], name: "idx_matches_status" },
        { fields: ["start_at"], name: "idx_matches_start_at" },
        { fields: ["team_a"], name: "idx_matches_team_a" },
        { fields: ["team_b"], name: "idx_matches_team_b" },
      ],
    }
  );

  return Match;
}
