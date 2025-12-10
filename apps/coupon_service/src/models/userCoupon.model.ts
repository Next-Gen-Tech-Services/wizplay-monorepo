import { DataTypes, Model, Optional, Sequelize, UUIDV4 } from "sequelize";

export interface IUserCouponAttrs {
  id: string;
  userId: string;
  couponId: string;
  redeemedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

type UserCouponCreationAttrs = Optional<
  IUserCouponAttrs,
  "id" | "createdAt" | "updatedAt" | "redeemedAt"
>;

export class UserCoupon
  extends Model<IUserCouponAttrs, UserCouponCreationAttrs>
  implements IUserCouponAttrs
{
  public id!: string;
  public userId!: string;
  public couponId!: string;
  public redeemedAt!: Date;

  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;
}

export default function (sequelize: Sequelize) {
  UserCoupon.init(
    {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: UUIDV4,
      },
      userId: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "User who redeemed the coupon (can be UUID)",
      },
      couponId: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: "Coupon that was redeemed",
      },
      redeemedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: "Timestamp when coupon was redeemed",
      },
    },
    {
      sequelize,
      modelName: "UserCoupon",
      tableName: "user_coupons",
      timestamps: true,
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ["coupon_id"],
          name: "unique_coupon",
        },
        {
          fields: ["user_id"],
          name: "user_id_index",
        },
        {
          fields: ["redeemed_at"],
          name: "redeemed_at_index",
        },
      ],
    }
  );

  // Validation hooks
  UserCoupon.addHook("beforeValidate", (uc: UserCoupon) => {
    if (!uc.userId) throw new Error("userId is required");
    if (!uc.couponId) throw new Error("couponId is required");
  });

  return UserCoupon;
}
