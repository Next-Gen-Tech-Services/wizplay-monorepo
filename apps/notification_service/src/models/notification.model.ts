// src/models/notification.model.ts
import { DataTypes, Model, Optional, Sequelize, UUIDV4 } from "sequelize";
import { NotificationType } from "@repo/notifications";

export interface INotificationAttrs {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  data: Record<string, any> | null;
  imageUrl: string | null;
  actionUrl: string | null;
  isRead: boolean;
  isSent: boolean;
  deviceToken: string | null;
  errorMessage: string | null;
  sentAt: Date | null;
  readAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface NotificationCreationAttributes
  extends Optional<
    INotificationAttrs,
    | "id"
    | "data"
    | "imageUrl"
    | "actionUrl"
    | "isRead"
    | "isSent"
    | "deviceToken"
    | "errorMessage"
    | "sentAt"
    | "readAt"
    | "createdAt"
    | "updatedAt"
  > {}

export class Notification
  extends Model<INotificationAttrs, NotificationCreationAttributes>
  implements INotificationAttrs
{
  public id!: string;
  public userId!: string;
  public title!: string;
  public body!: string;
  public type!: NotificationType;
  public data!: Record<string, any> | null;
  public imageUrl!: string | null;
  public actionUrl!: string | null;
  public isRead!: boolean;
  public isSent!: boolean;
  public deviceToken!: string | null;
  public errorMessage!: string | null;
  public sentAt!: Date | null;
  public readAt!: Date | null;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;
}

export default function (sequelize: Sequelize) {
  Notification.init(
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
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      body: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      type: {
        type: DataTypes.ENUM(...(Object.values(NotificationType) as string[])),
        allowNull: false,
      },
      data: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
      },
      imageUrl: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
      },
      actionUrl: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
      },
      isRead: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      isSent: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      deviceToken: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
      },
      errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
      },
      sentAt: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      readAt: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
    },
    {
      sequelize,
      modelName: "Notification",
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ["user_id"] },
        { fields: ["user_id", "is_read"] },
        { fields: ["created_at"] },
      ],
    }
  );

  Notification.addHook("beforeSave", (n: Notification) => {
    if (n.isSent && !n.sentAt) n.sentAt = new Date();
  });

  Notification.addHook("beforeSave", (n: Notification) => {
    if (n.isRead && !n.readAt) n.readAt = new Date();
  });

  return Notification;
}
