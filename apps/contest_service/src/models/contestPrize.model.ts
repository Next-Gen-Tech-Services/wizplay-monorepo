import { DataTypes, Model, Optional, Sequelize, UUIDV4 } from "sequelize";

export interface IContestPrizeAttrs {
  id: string;
  contestId: string;
  rankFrom: number;
  rankTo: number;
  amount: number;
  percent?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ContestPrizeCreationAttributes
  extends Optional<
    IContestPrizeAttrs,
    "id" | "createdAt" | "updatedAt" | "percent"
  > {}

export class ContestPrize
  extends Model<IContestPrizeAttrs, ContestPrizeCreationAttributes>
  implements IContestPrizeAttrs
{
  public id!: string;
  public contestId!: string;
  public rankFrom!: number;
  public rankTo!: number;
  public amount!: number;
  public percent!: number | null;

  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;
}

export default function (sequelize: Sequelize) {
  ContestPrize.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: UUIDV4,
      },
      contestId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      rankFrom: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      rankTo: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      amount: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0,
      },
      percent: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        defaultValue: null,
      },
    },
    {
      sequelize,
      modelName: "ContestPrize",
      tableName: "contest_prizes",
      timestamps: true,
      underscored: true,
    }
  );

  return ContestPrize;
}
