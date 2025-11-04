// src/repositories/notification.repository.ts
import { logger } from "@repo/common";
import { Op } from "sequelize";
import { DB } from "../configs/database.config";

export default class NotificationRepository {
  private _DB = DB;

  constructor() {}

  public async create(payload: any) {
    try {
      const notification = await this._DB.Notification.create(payload);
      return notification;
    } catch (err: any) {
      logger.error(`NotificationRepository.create error: ${err?.message ?? err}`);
      throw err;
    }
  }

  public async findById(id: string) {
    try {
      return await this._DB.Notification.findByPk(id);
    } catch (err: any) {
      logger.error(`NotificationRepository.findById error: ${err?.message ?? err}`);
      throw err;
    }
  }

  public async findByUserId(userId: string, limit = 50, offset = 0) {
    try {
      const notifications = await this._DB.Notification.findAll({
        where: { userId },
        order: [["createdAt", "DESC"]],
        limit,
        offset,
      });
      return notifications;
    } catch (err: any) {
      logger.error(`NotificationRepository.findByUserId error: ${err?.message ?? err}`);
      throw err;
    }
  }

  public async countUnread(userId: string) {
    try {
      const count = await this._DB.Notification.count({
        where: { userId, isRead: false },
      });
      return count;
    } catch (err: any) {
      logger.error(`NotificationRepository.countUnread error: ${err?.message ?? err}`);
      throw err;
    }
  }

  public async markAsRead(id: string) {
    try {
      const [updated] = await this._DB.Notification.update(
        { isRead: true, readAt: new Date() },
        { where: { id } }
      );
      return updated > 0;
    } catch (err: any) {
      logger.error(`NotificationRepository.markAsRead error: ${err?.message ?? err}`);
      throw err;
    }
  }

  public async markAllAsRead(userId: string) {
    try {
      const [updated] = await this._DB.Notification.update(
        { isRead: true, readAt: new Date() },
        { where: { userId, isRead: false } }
      );
      return updated;
    } catch (err: any) {
      logger.error(`NotificationRepository.markAllAsRead error: ${err?.message ?? err}`);
      throw err;
    }
  }

  public async updateSentStatus(id: string, isSent: boolean, errorMessage?: string) {
    try {
      const [updated] = await this._DB.Notification.update(
        {
          isSent,
          sentAt: isSent ? new Date() : null,
          errorMessage: errorMessage || null,
        },
        { where: { id } }
      );
      return updated > 0;
    } catch (err: any) {
      logger.error(`NotificationRepository.updateSentStatus error: ${err?.message ?? err}`);
      throw err;
    }
  }

  public async deleteById(id: string) {
    try {
      const deleted = await this._DB.Notification.destroy({ where: { id } });
      return deleted > 0;
    } catch (err: any) {
      logger.error(`NotificationRepository.deleteById error: ${err?.message ?? err}`);
      throw err;
    }
  }

  public async deleteOld(daysOld: number = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const deleted = await this._DB.Notification.destroy({
        where: {
          createdAt: { [Op.lt]: cutoffDate },
          isRead: true,
        },
      });
      return deleted;
    } catch (err: any) {
      logger.error(`NotificationRepository.deleteOld error: ${err?.message ?? err}`);
      throw err;
    }
  }
}
