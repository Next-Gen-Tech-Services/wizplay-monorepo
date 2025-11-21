import { DataTypes, Model, Sequelize } from "sequelize";

export interface IMatchLiveStateAttrs {
  matchId: string;
  currentScore: any; // JSONB
  lastBallKey: string | null;
  inningsIndex: string | null;
  battingTeam: string | null;
  bowlingTeam: string | null;
  lastUpdated: Date;
}

export class MatchLiveState
  extends Model<IMatchLiveStateAttrs>
  implements IMatchLiveStateAttrs
{
  public matchId!: string;
  public currentScore!: any;
  public lastBallKey!: string | null;
  public inningsIndex!: string | null;
  public battingTeam!: string | null;
  public bowlingTeam!: string | null;
  public lastUpdated!: Date;
}

export default function (sequelize: Sequelize) {
  MatchLiveState.init(
    {
      matchId: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
        field: "match_id",
      },
      currentScore: {
        type: DataTypes.JSONB,
        allowNull: false,
        field: "current_score",
      },
      lastBallKey: {
        type: DataTypes.STRING,
        allowNull: true,
        field: "last_ball_key",
      },
      inningsIndex: {
        type: DataTypes.STRING,
        allowNull: true,
        field: "innings_index",
      },
      battingTeam: {
        type: DataTypes.STRING,
        allowNull: true,
        field: "batting_team",
      },
      bowlingTeam: {
        type: DataTypes.STRING,
        allowNull: true,
        field: "bowling_team",
      },
      lastUpdated: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "last_updated",
      },
    },
    {
      sequelize,
      tableName: "match_live_states",
      timestamps: false,
      underscored: true,
    }
  );

  return MatchLiveState;
}
