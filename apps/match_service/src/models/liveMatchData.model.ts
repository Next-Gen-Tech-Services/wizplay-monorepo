import { DataTypes, Model, Optional, Sequelize } from "sequelize";

export interface ILiveMatchDataAttrs {
  id: string;
  matchKey: string;
  simplifiedData: any; // JSONB
  createdAt?: Date;
  updatedAt?: Date;
}

interface LiveMatchDataCreationAttrs
  extends Optional<ILiveMatchDataAttrs, "id" | "createdAt" | "updatedAt"> { }

export class LiveMatchData
  extends Model<ILiveMatchDataAttrs, LiveMatchDataCreationAttrs>
  implements ILiveMatchDataAttrs {
  public id!: string;
  public matchKey!: string;
  public simplifiedData!: any;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export default function (sequelize: Sequelize) {
  LiveMatchData.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      matchKey: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      simplifiedData: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "LiveMatchData",
      tableName: "match_details",
      timestamps: true,
      underscored: true,
    }
  );

  return LiveMatchData;
}
