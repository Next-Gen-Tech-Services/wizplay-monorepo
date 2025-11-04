// src/models/notification.model.ts
import { DataTypes, Model, Optional, Sequelize, UUIDV4 } from "sequelize";

export interface INotificationAttrs {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  data?: any;
  imageUrl?: string | null;
  actionUrl?: string | null;
  isRead: boolean;
  isSent: boolean;
  deviceToken?: string | null;
  errorMessage?: string | null;
  sentAt?: Date | null;
  readAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface NotificationCreationAttributes
  extends Optional<
    INotificationAttrs,
    | "id"
    | "createdAt"
    | "updatedAt"
    | "data"
    | "imageUrl"
    | "actionUrl"
    | "deviceToken"
    | "errorMessage"
    | "sentAt"
    | "readAt"
    | "isRead"
    | "isSent"
  > {}

export class Notification
  extends Model<INotificationAttrs, NotificationCreationAttributes>
  implements INotificationAttrs
{
  public id!: string;
  public userId!: string;
  public title!: string;
  public body!: string;
  public type!: string;
  public data!: any;
  public imageUrl!: string | null;
  public actionUrl!: string | null;
  public isRead!: boolean;
  public isSent!: boolean;
  public deviceToken!: string | null;
  public errorMessage!: string | null;
  public sentAt!: Date | null;
  public readAt!: Date | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
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
        type: DataTypes.STRING(128),
        allowNull: false,
        field: "user_id",
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      body: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      type: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      data: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
      },
      imageUrl: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: "image_url",
      },
      actionUrl: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: "action_url",
      },
      isRead: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "is_read",
      },
      isSent: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "is_sent",
      },
      deviceToken: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: "device_token",
      },
      errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "error_message",
      },
      sentAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "sent_at",
      },
      readAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "read_at",
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: "created_at",
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: "updated_at",
      },
    },
    {
      sequelize,
      modelName: "Notification",
      tableName: "notifications",
      timestamps: true,
      underscored: true,
      indexes: [
        {
          fields: ["user_id", "created_at"],
          name: "idx_notifications_user_created",
        },
        {
          fields: ["user_id", "is_read"],
          name: "idx_notifications_user_read",
        },
        {
          fields: ["type"],
          name: "idx_notifications_type",
        },
        {
          fields: ["is_sent"],
          name: "idx_notifications_sent",
        },
      ],
    }
  );

  return Notification;
}
