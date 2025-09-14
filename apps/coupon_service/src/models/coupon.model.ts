import { DataTypes, Model, Optional, Sequelize, UUIDV4 } from "sequelize";

export type CouponStatus = "active" | "expired" | "used" | "inactive";
export type DiscountType = "flat" | "percent";

export interface ICouponAttrs {
  id: string;
  code: string;
  title: string;
  platform: string;
  discountType: DiscountType;
  discountValue: number;
  purchaseAmount: number;
  expiry: Date;
  status: CouponStatus;
  usageCount: number;
  maxUsePerUser?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type CouponCreationAttrs = Optional<
  ICouponAttrs,
  "id" | "createdAt" | "updatedAt" | "usageCount" | "status" | "maxUsePerUser"
>;

export class Coupon
  extends Model<ICouponAttrs, CouponCreationAttrs>
  implements ICouponAttrs
{
  public id!: string;
  public code!: string;
  public title!: string;
  public platform!: string;
  public discountType!: DiscountType;
  public discountValue!: number;
  public purchaseAmount!: number;
  public expiry!: Date;
  public status!: CouponStatus;
  public usageCount!: number;
  public maxUsePerUser?: number | null;

  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;
}

export default function (sequelize: Sequelize) {
  Coupon.init(
    {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: UUIDV4,
      },
      code: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      platform: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      discountType: {
        type: DataTypes.ENUM("flat", "percent"),
        allowNull: false,
      },
      discountValue: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      purchaseAmount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      expiry: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("active", "expired", "used", "inactive"),
        allowNull: false,
        defaultValue: "inactive",
      },
      usageCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      maxUsePerUser: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
    },
    {
      sequelize,
      modelName: "Coupon",
      tableName: "coupons",
      timestamps: true,
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ["code"],
        },
        {
          fields: ["platform"],
        },
        {
          fields: ["status"],
        },
        // partial index example similar to your Auth indexes (non-null)
        {
          fields: ["expiry"],
        },
      ],
      defaultScope: {
        where: {
          // no default filter; keep it empty
        },
      },
    }
  );

  // Hooks: ensure expiry is a Date and discountValue non-negative
  Coupon.addHook("beforeValidate", (c: Coupon) => {
    if (!c.code) throw new Error("code is required");
    if (c.discountValue < 0) throw new Error("discountValue must be >= 0");
    if (!(c.expiry instanceof Date)) {
      c.expiry = new Date(c.expiry as any);
    }
  });

  // Example: auto-mark expired on load (not persisted)
  Coupon.addHook("afterFind", (found: any) => {
    const checkExpired = (row: any) => {
      if (!row) return;
      try {
        if (
          row.expiry &&
          new Date(row.expiry) < new Date() &&
          row.status !== "expired"
        ) {
          // do not automatically persist here, just annotate
          (row as any).dataValues._computedExpired = true;
        }
      } catch {}
    };

    if (Array.isArray(found)) found.forEach(checkExpired);
    else checkExpired(found);
  });

  return Coupon;
}
