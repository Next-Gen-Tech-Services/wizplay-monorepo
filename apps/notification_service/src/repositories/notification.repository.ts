// src/repositories/notification.repository.ts
import { autoInjectable } from "tsyringe";
import { Op } from "sequelize";
import { logger, ServerError } from "@repo/common";
import { NotificationType } from "@repo/notifications";
import { DB, IDatabase } from "../configs/database.config";

@autoInjectable()
export default class NotificationRepository {
  private _DB: IDatabase = DB;

  /**
   * Create a new notification
   */
  public async create(data: {
    userId: string | null;
    recipientType: 'user_id' | 'email' | 'phone' | 'all_users';
    recipientValue: string | null;
    title: string;
    body: string;
    type: NotificationType;
    data?: Record<string, any>;
    imageUrl?: string | null;
    actionUrl?: string | null;
    deviceToken?: string | null;
    isSent: boolean;
    isRead: boolean;
  }) {
    try {
      const result = await this._DB.Notification.create({
        ...data,
        data: data.data ?? {},
        imageUrl: data.imageUrl ?? null,
        actionUrl: data.actionUrl ?? null,
        deviceToken: data.deviceToken ?? null,
      });
      return result;
    } catch (err: any) {
      logger.error(`DB(create) Notification error: ${err?.message ?? err}`);
      throw new ServerError("Database Error");
    }
  }

  /**
   * Find notification by ID
   */
  public async findById(id: string) {
    try {
      return await this._DB.Notification.findByPk(id);
    } catch (err: any) {
      logger.error(`DB(findById) Notification error: ${err?.message ?? err}`);
      throw new ServerError("Database Error");
    }
  }

  /**
   * Find notifications by user ID (paginated, newest first)
   */
  public async findByUserId(userId: string, limit = 50, offset = 0) {
    try {
      return await this._DB.Notification.findAll({
        where: { userId },
        limit,
        offset,
        order: [["createdAt", "DESC"]],
      });
    } catch (err: any) {
      logger.error(`DB(findByUserId) Notification error: ${err?.message ?? err}`);
      throw new ServerError("Database Error");
    }
  }

  public async findAll(limit = 50, offset = 0) {
    try {
      const { rows, count } = await this._DB.Notification.findAndCountAll({
        limit,
        offset,
        order: [["createdAt", "DESC"]],
      });
      return { items: rows, total: count };
    }
    catch (err: any) {
      logger.error(`DB(findAll) Notification error: ${err?.message ?? err}`);
      throw new ServerError("Database Error");
    }
  }

  /**
   * Count unread notifications for a user
   */
  public async countUnread(userId: string) {
    try {
      return await this._DB.Notification.count({
        where: { userId, isRead: false },
      });
    } catch (err: any) {
      logger.error(`DB(countUnread) Notification error: ${err?.message ?? err}`);
      throw new ServerError("Database Error");
    }
  }

  /**
   * Mark notification as read
   */
  public async markAsRead(id: string) {
    try {
      const notification = await this._DB.Notification.findByPk(id);
      if (notification) {
        notification.isRead = true;
        notification.readAt = new Date();
        await notification.save();
      }
      return notification;
    } catch (err: any) {
      logger.error(`DB(markAsRead) Notification error: ${err?.message ?? err}`);
      throw new ServerError("Database Error");
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  public async markAllAsRead(userId: string) {
    try {
      const [count] = await this._DB.Notification.update(
        { isRead: true, readAt: new Date() },
        { where: { userId, isRead: false } }
      );
      return count;
    } catch (err: any) {
      logger.error(`DB(markAllAsRead) Notification error: ${err?.message ?? err}`);
      throw new ServerError("Database Error");
    }
  }

  /**
   * Update sent status (and error message if failed)
   */
  public async updateSentStatus(id: string, isSent: boolean, errorMessage?: string | null) {
    try {
      const notification = await this._DB.Notification.findByPk(id);
      if (notification) {
        notification.isSent = isSent;
        notification.sentAt = isSent ? new Date() : null;
        notification.errorMessage = errorMessage ?? null;
        await notification.save();
      }
      return notification;
    } catch (err: any) {
      logger.error(`DB(updateSentStatus) Notification error: ${err?.message ?? err}`);
      throw new ServerError("Database Error");
    }
  }

  /**
   * Delete notification by ID
   */
  public async deleteById(id: string) {
    try {
      return await this._DB.Notification.destroy({ where: { id } });
    } catch (err: any) {
      logger.error(`DB(deleteById) Notification error: ${err?.message ?? err}`);
      throw new ServerError("Database Error");
    }
  }

  /**
   * Delete all notifications for a user
   */
  public async deleteByUserId(userId: string) {
    try {
      return await this._DB.Notification.destroy({ where: { userId } });
    } catch (err: any) {
      logger.error(`DB(deleteByUserId) Notification error: ${err?.message ?? err}`);
      throw new ServerError("Database Error");
    }
  }

  /**
   * Delete old notifications (older than specified days)
   */
  public async deleteOld(days: number = 30) {
    try {
      const date = new Date();
      date.setDate(date.getDate() - days);

      return await this._DB.Notification.destroy({
        where: {
          createdAt: { [Op.lt]: date },
        },
      });
    } catch (err: any) {
      logger.error(`DB(deleteOld) Notification error: ${err?.message ?? err}`);
      throw new ServerError("Database Error");
    }
  }

  /**
   * Update notification with userId when found via email/phone lookup
   */
  public async updateNotificationUserId(notificationId: string, userId: string) {
    try {
      return await this._DB.Notification.update(
        { userId },
        { where: { id: notificationId } }
      );
    } catch (err: any) {
      logger.error(`DB(updateNotificationUserId) error: ${err?.message ?? err}`);
      throw new ServerError("Database Error");
    }
  }
}
