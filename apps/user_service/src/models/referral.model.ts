import { DataTypes, Model, Optional, Sequelize, UUIDV4 } from "sequelize";

export interface IReferralAttrs {
  id: string;
  referrerId: string; // User who referred (has the referral code)
  referredUserId: string; // User who was referred (used the code)
  referralCode: string; // The code that was used
  rewardAmount: number; // Amount rewarded to referrer
  rewardStatus: "pending" | "completed" | "failed";
  createdAt?: Date;
  updatedAt?: Date;
}

interface ReferralCreationAttributes
  extends Optional<
    IReferralAttrs,
    "id" | "rewardAmount" | "rewardStatus" | "createdAt" | "updatedAt"
  > {}

export class Referral
  extends Model<IReferralAttrs, ReferralCreationAttributes>
  implements IReferralAttrs
{
  public id!: string;
  public referrerId!: string;
  public referredUserId!: string;
  public referralCode!: string;
  public rewardAmount!: number;
  public rewardStatus!: "pending" | "completed" | "failed";
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;
}

export default function (sequelize: Sequelize) {
  Referral.init(
    {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: UUIDV4,
      },
      referrerId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      referredUserId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      referralCode: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      rewardAmount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 50,
      },
      rewardStatus: {
        type: DataTypes.ENUM("pending", "completed", "failed"),
        allowNull: false,
        defaultValue: "pending",
      },
    },
    {
      sequelize,
      modelName: "Referral",
      tableName: "referrals",
      timestamps: true,
      underscored: true,
      indexes: [
        {
          fields: ["referrer_id"],
        },
        {
          fields: ["referred_user_id"],
        },
        {
          fields: ["referral_code"],
        },
      ],
    }
  );

  return Referral;
}
