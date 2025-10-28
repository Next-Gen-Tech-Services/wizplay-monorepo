import { DataTypes, Model, Op, Optional, Sequelize, UUIDV4 } from "sequelize";

export interface IContestCouponAttrs {
  id: string;
  matchId: string;
  contestId: string;
  userId: string | null;
  couponId: string;
  rank: number;
  assignedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type ContestCouponCreationAttrs = Optional<
  IContestCouponAttrs,
  "id" | "createdAt" | "updatedAt" | "userId" | "assignedAt"
>;

export class ContestCoupon
  extends Model<IContestCouponAttrs, ContestCouponCreationAttrs>
  implements IContestCouponAttrs
{
  public id!: string;
  public matchId!: string;
  public contestId!: string;
  public userId!: string | null;
  public couponId!: string;
  public rank!: number;
  public assignedAt!: Date | null;

  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;
}

export default function (sequelize: Sequelize) {
  ContestCoupon.init(
    {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: UUIDV4,
      },
      matchId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      contestId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: true,
        defaultValue: null,
        comment: "Assigned when contest ends and winner is determined",
      },
      couponId: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: "Pre-assigned when contest is created",
      },
      rank: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
          max: 3,
        },
        comment: "Rank position (1-3) assigned to this coupon",
      },
      assignedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
        comment: "Timestamp when userId was assigned (contest ended)",
      },
    },
    {
      sequelize,
      modelName: "ContestCoupon",
      tableName: "contest_coupons",
      timestamps: true,
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ["contest_id", "rank"],
          name: "unique_contest_rank",
        },
        {
          unique: true,
          fields: ["contest_id", "user_id"],
          name: "unique_contest_user",
          where: {
            user_id: { [Op.ne]: null },
          },
        },
      ],
    }
  );

  // Validation hooks
  ContestCoupon.addHook("beforeValidate", (cc: ContestCoupon) => {
    if (!cc.matchId) throw new Error("matchId is required");
    if (!cc.contestId) throw new Error("contestId is required");
    if (!cc.couponId) throw new Error("couponId is required");
    if (![1, 2, 3].includes(cc.rank)) {
      throw new Error("rank must be 1, 2, or 3");
    }
  });

  // Auto-set assignedAt when userId is assigned
  ContestCoupon.addHook("beforeSave", (cc: ContestCoupon) => {
    if (cc.userId && !cc.assignedAt) {
      cc.assignedAt = new Date();
    }
  });

  return ContestCoupon;
}
