import { DataTypes, Model, Optional, Sequelize, UUIDV4 } from "sequelize";
import { IWalletAttrs } from "../dtos/wallet.dto";

interface WalletCreationAttributes
  extends Optional<
    IWalletAttrs,
    | "id"
    | "totalDeposited"
    | "totalWithdrawn"
    | "totalWinnings"
    | "currency"
    | "status"
    | "createdAt"
    | "updatedAt"
  > {}

export class Wallet
  extends Model<IWalletAttrs, WalletCreationAttributes>
  implements IWalletAttrs
{
  public id!: string;
  public userId!: string;
  public balance!: number;
  public totalDeposited!: number;
  public totalWithdrawn!: number;
  public totalWinnings!: number;
  public currency!: string;
  public status!: "active" | "suspended" | "closed";

  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;
}

export default function (sequelize: Sequelize) {
  Wallet.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: UUIDV4,
      },

      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
      },

      balance: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0,
        },
      },

      totalDeposited: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0,
        },
      },

      totalWithdrawn: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0,
        },
      },

      totalWinnings: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0,
        },
      },

      currency: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: "INR",
      },

      status: {
        type: DataTypes.ENUM("active", "suspended", "closed"),
        allowNull: false,
        defaultValue: "active",
      },
    },
    {
      sequelize,
      modelName: "Wallet",
      timestamps: true,
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ["user_id"],
        },
        {
          fields: ["status"],
        },
      ],
    }
  );

  return Wallet;
}
