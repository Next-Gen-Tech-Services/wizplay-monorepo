import { DataTypes, Model, Op, Optional, Sequelize, UUIDV4 } from "sequelize";
import { IAuthAtters } from "../dtos/auth.dto";

interface AuthCreationAttributes
  extends Optional<
    IAuthAtters,
    | "id"
    | "createdAt"
    | "updatedAt"
    | "onboarded"
    | "otpCode"
    | "password"
    | "lastLoginAt"
    | "phoneNumber"
    | "email"
    | "appleUserId"
    | "otpExpiresAt"
  > {}

export class Auth
  extends Model<IAuthAtters, AuthCreationAttributes>
  implements IAuthAtters
{
  public id!: string;
  public userId!: string;
  public email!: string | null;
  public phoneNumber!: string | null;
  public appleUserId!: string | null;
  public provider!: "local" | "google" | "apple" | "email";
  public type!: "user" | "admin";
  public password?: string | null;
  public otpCode!: string | null;
  public otpExpiresAt!: Date | null;
  public lastLoginAt!: Date | null;
  public onboarded: boolean;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;
}

export default function (sequelize: Sequelize) {
  Auth.init(
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
      email: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
      },
      phoneNumber: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
      },
      appleUserId: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
      },
      provider: {
        type: DataTypes.ENUM("local", "google", "apple", "email"),
        allowNull: false,
        defaultValue: "local",
      },
      password: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
      },
      otpCode: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
      },
      lastLoginAt: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      onboarded: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      otpExpiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      type: {
        type: DataTypes.ENUM("user", "admin"),
        allowNull: false,
        defaultValue: "user",
      },
    },
    {
      sequelize,
      modelName: "Auth",
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
          fields: ["phone_number"], // Note: underscored naming
          where: {
            phone_number: {
              [Op.ne]: null,
            },
          },
        },
        {
          unique: true,
          fields: ["apple_user_id"],
          where: {
            apple_user_id: {
              [Op.ne]: null,
            },
          },
        },
      ],
    }
  );

  Auth.addHook("beforeValidate", (auth: Auth) => {
    if (auth.provider === "email" && !auth.email) {
      throw new Error("Email is required when provider is email");
    }
  });

  Auth.addHook("beforeValidate", (auth: Auth) => {
    if (auth.provider === "email" && !auth.password) {
      throw new Error("Password is required when provider is email");
    }
  });

  return Auth;
}
