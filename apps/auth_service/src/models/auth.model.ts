import { DataTypes, Model, Optional, Sequelize, UUIDV4 } from "sequelize";
import { IAuthAtters } from "../dtos/auth.dto";

interface AuthCreationAttributes
  extends Optional<
    IAuthAtters,
    | "id"
    | "createdAt"
    | "updatedAt"
    | "onboarded"
    | "otpCode"
    | "lastLoginAt"
    | "phoneNumber"
    | "email"
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
  public provider!: "local" | "google" | "apple";
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
        unique: true,
        defaultValue: null,
      },
      phoneNumber: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
        defaultValue: null,
      },
      provider: {
        type: DataTypes.ENUM("local", "google", "apple"),
        allowNull: false,
        defaultValue: "local",
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
    },
    {
      sequelize,
      modelName: "Auth",
      timestamps: true,
      underscored: true,
    }
  );

  return Auth;
}
