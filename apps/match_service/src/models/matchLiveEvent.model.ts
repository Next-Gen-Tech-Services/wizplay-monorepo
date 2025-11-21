import { DataTypes, Model, Optional, Sequelize } from "sequelize";

export type MatchLiveEventType =
  | "wicket"
  | "boundary"
  | "milestone"
  | "over_complete"
  | "innings_end"
  | "match_end";

export interface IMatchLiveEventAttrs {
  id: string;
  matchId: string;
  eventType: MatchLiveEventType;
  eventData: any; // JSONB
  ballKey: string | null;
  timestamp: Date;
  createdAt: Date;
}

interface MatchLiveEventCreationAttrs
  extends Optional<IMatchLiveEventAttrs, "id" | "createdAt"> {}

export class MatchLiveEvent
  extends Model<IMatchLiveEventAttrs, MatchLiveEventCreationAttrs>
  implements IMatchLiveEventAttrs
{
  public id!: string;
  public matchId!: string;
  public eventType!: MatchLiveEventType;
  public eventData!: any;
  public ballKey!: string | null;
  public timestamp!: Date;
  public createdAt!: Date;
}

export default function (sequelize: Sequelize) {
  MatchLiveEvent.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      matchId: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "match_id",
      },
      eventType: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "event_type",
      },
      eventData: {
        type: DataTypes.JSONB,
        allowNull: false,
        field: "event_data",
      },
      ballKey: {
        type: DataTypes.STRING,
        allowNull: true,
        field: "ball_key",
      },
      timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
        field: "created_at",
      },
    },
    {
      sequelize,
      tableName: "match_live_events",
      timestamps: false,
      underscored: true,
    }
  );

  return MatchLiveEvent;
}
