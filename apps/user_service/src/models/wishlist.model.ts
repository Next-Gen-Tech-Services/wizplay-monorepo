// src/models/wishlist.model.ts
import { DataTypes, Model, Optional, Sequelize } from "sequelize";

export interface IWishlistAttributes {
  id?: string;
  userId: string;
  matchId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface WishlistCreationAttributes
  extends Optional<IWishlistAttributes, "id" | "createdAt" | "updatedAt"> {}

export class Wishlist
  extends Model<IWishlistAttributes, WishlistCreationAttributes>
  implements IWishlistAttributes
{
  public id!: string;
  public userId!: string;
  public matchId!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export default function (sequelize: Sequelize) {
  Wishlist.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      matchId: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
      },
    },
    {
      sequelize,
      tableName: "wishlists",
      timestamps: true,
      underscored: true,
    }
  );

  return Wishlist;
}
