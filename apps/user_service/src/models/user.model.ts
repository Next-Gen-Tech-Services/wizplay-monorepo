import { DataTypes, Model, Op, Optional, Sequelize, UUIDV4 } from "sequelize";
import { IUserAtters } from "../dtos/user.dto";
import { Language } from "../types";

interface UserCreationAttributes
  extends Optional<
    IUserAtters,
    | "id"
    | "createdAt"
    | "updatedAt"
    | "onboarded"
    | "phoneNumber"
    | "email"
    | "name"
  > {}

export class User
  extends Model<IUserAtters, UserCreationAttributes>
  implements IUserAtters
{
  id!: string;
  userId!: string;
  authId!: string;
  email?: string | null;
  name?: string | null;
  phoneNumber?: string | null;
  onboarded!: boolean;
  userName!: string;
  type: "user" | "admin";
  selectedLanguage!: Language;
  referralCode?: string | null;
  deviceToken?: string | null;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;
}

export default function (sequelize: Sequelize) {
  User.init(
    {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: UUIDV4,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      authId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      userName: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
      },
      phoneNumber: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
      },
      onboarded: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      type: {
        type: DataTypes.ENUM("user", "admin"),
        allowNull: false,
        defaultValue: "user",
      },
      selectedLanguage: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: Language.ENGLISH,
      },
      referralCode: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
        defaultValue: null,
      },
      deviceToken: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
      },
    },
    {
      sequelize,
      modelName: "User",
      timestamps: true,
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ["email"],
          where: {
            email: {
              [Op.ne]: null,
            },
          },
        },
        {
          unique: true,
          fields: ["phone_number"],
          where: {
            phone_number: {
              [Op.ne]: null,
            },
          },
        },
        {
          unique: true,
          fields: ["referral_code"],
          where: {
            referral_code: {
              [Op.ne]: null,
            },
          },
        },
      ],
    }
  );

  return User;
}
