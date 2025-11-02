// ===========================
// src/models/walletTransaction.model.ts
// ===========================

import { DataTypes, Model, Optional, Sequelize, UUIDV4 } from "sequelize";
import {
  IWalletTransactionAttributes,
  TransactionStatus,
  TransactionType,
} from "../dtos/wallet.dto";

interface WalletTransactionCreationAttributes
  extends Optional<
    IWalletTransactionAttributes,
    | "id"
    | "referenceId"
    | "referenceType"
    | "status"
    | "createdAt"
    | "updatedAt"
  > {}

export class WalletTransaction
  extends Model<
    IWalletTransactionAttributes,
    WalletTransactionCreationAttributes
  >
  implements IWalletTransactionAttributes
{
  public id!: string;
  public walletId!: string;
  public userId!: string;
  public type!: TransactionType;
  public amount!: number;
  public balanceBefore!: number;
  public balanceAfter!: number;
  public referenceId!: string | null;
  public referenceType!: string | null;
  public status!: TransactionStatus;

  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;
}

export default function (sequelize: Sequelize) {
  WalletTransaction.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: UUIDV4,
      },

      walletId: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      type: {
        type: DataTypes.ENUM(
          "deposit",
          "withdrawal",
          "contest_entry",
          "contest_refund",
          "contest_winnings",
          "bonus",
          "joining_bonus",
          "referral"
        ),
        allowNull: false,
      },

      amount: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      balanceBefore: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      balanceAfter: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      referenceId: {
        type: DataTypes.UUID,
        allowNull: true,
        defaultValue: null,
      },

      referenceType: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: null,
      },

      status: {
        type: DataTypes.ENUM("pending", "completed", "failed", "cancelled"),
        allowNull: false,
        defaultValue: "completed",
      },
    },
    {
      sequelize,
      modelName: "WalletTransaction",
      tableName: "wallet_transactions",
      timestamps: true,
      underscored: true,
      indexes: [
        {
          fields: ["wallet_id"],
        },
        {
          fields: ["user_id"],
        },
        {
          fields: ["type"],
        },
        {
          fields: ["status"],
        },
        {
          fields: ["reference_id"],
        },
        {
          fields: ["created_at"],
        },
      ],
    }
  );

  return WalletTransaction;
}
