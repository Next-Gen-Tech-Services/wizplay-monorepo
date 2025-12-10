import { logger, STATUS_CODE } from "@repo/common";
import { Request, Response } from "express";
import "tsyringe";
import { autoInjectable } from "tsyringe";
import NotificationService from "../services/notification.service";

@autoInjectable()
export default class NotificationController {
  constructor(private readonly notificationService: NotificationService) { }

  public async getNotifications(req: Request, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: "Bad Request",
        });
      }

      const limitNum = Math.max(1, Math.min(100, Number(req.query.limit) || 50));
      const offsetNum = Math.max(0, Number(req.query.offset) || 0);

      const { data, message } = await this.notificationService.getUserNotifications(
        userId,
        limitNum,
        offsetNum
      );

      logger.info(
        `Request ID:${req.headers["x-request-id"]} | message: Notifications fetched`
      );

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        message: message ?? "OK",
        data: {
          notifications: data.notifications,
          unreadCount: data.unreadCount,
          total: data.total,
          pagination: { limit: limitNum, offset: offsetNum, count: data.notifications.length },
        },
      });
    } catch (err: any) {
      logger.error(
        `Request ID:${req.headers["x-request-id"]} | error: ${err?.message ?? err}`
      );
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        message: err?.message ?? "Failed to fetch notifications",
      });
    }
  }


  public async getAllNotifications(req: Request, res: Response) {
    try {
      
      const limitNum = Math.max(1, Math.min(100, Number(req.query.limit) || 50));
      const offsetNum = Math.max(0, Number(req.query.offset) || 0);

      const { data, message } = await this.notificationService.getAllNotifications(
        limitNum,
        offsetNum
      );

      logger.info(
        `Request ID:${req.headers["x-request-id"]} | message: Notifications fetched`
      );

      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        message: message ?? "OK",
        data: {
          notifications: data.notifications,
          total: data.total,
          pagination: { limit: limitNum, offset: offsetNum, count: data.notifications.length },
        },
      });
    } catch (err: any) {
      logger.error(
        `Request ID:${req.headers["x-request-id"]} | error: ${err?.message ?? err}`
      );
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        message: err?.message ?? "Failed to fetch notifications",
      });
    }
  }

  public async markAsRead(req: Request, res: Response) {
    try {
      const notificationId = req.params.id;
      if (!notificationId) {
        return res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: "Bad Request",
        });
      }
      
      const { data, message } = await this.notificationService.markAsRead(notificationId);
      logger.info(
        `Request ID:${req.headers["x-request-id"]} | message: Notification marked as read`
      );
      
      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        message: message ?? "Marked as read",
        data: data,
      });
    } catch (err: any) {
      logger.error(
        `Request ID:${req.headers["x-request-id"]} | error: ${err?.message ?? err}`
      );
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        message: err?.message ?? "Failed to mark notification as read",
      });
    }
  }

  public async markAllAsRead(req: Request, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: "Bad Request",
        });
      }
      
      const { data, message } = await this.notificationService.markAllAsRead(userId);
      logger.info(
        `Request ID:${req.headers["x-request-id"]} | message: All notifications marked as read`
      );
      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        message: message ?? "All marked as read",
        data: data,
      });
    }
    catch (err: any) {
      logger.error(
        `Request ID:${req.headers["x-request-id"]} | error: ${err?.message ?? err
      }`
      );
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        message: err?.message ?? "Failed to mark all notifications as read",
      });
    }
  }

  public async getNotificationById(req: Request, res: Response) {
    try {
      const notificationId = req.params.id;
      const userId = req.userId;
      
      if (!notificationId || !userId) {
        return res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: "Bad Request",
        });
      }

      const { data, message } = await this.notificationService.getNotificationById(notificationId, userId);
      
      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        message: message ?? "OK",
        data: data,
      });
    } catch (err: any) {
      logger.error(
        `Request ID:${req.headers["x-request-id"]} | error: ${err?.message ?? err}`
      );
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        message: err?.message ?? "Failed to fetch notification",
      });
    }
  }

  public async deleteNotification(req: Request, res: Response) {
    try {
      const notificationId = req.params.id;
      const userId = req.userId;
      
      if (!notificationId || !userId) {
        return res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: "Bad Request",
        });
      }

      const { data, message } = await this.notificationService.deleteNotification(notificationId, userId);
      
      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        message: message ?? "Notification deleted",
        data: data,
      });
    } catch (err: any) {
      logger.error(
        `Request ID:${req.headers["x-request-id"]} | error: ${err?.message ?? err}`
      );
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        message: err?.message ?? "Failed to delete notification",
      });
    }
  }

  public async deleteAllNotifications(req: Request, res: Response) {
    try {
      const userId = req.userId;
      
      if (!userId) {
        return res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: "Bad Request",
        });
      }

      const { data, message } = await this.notificationService.deleteAllNotifications(userId);
      
      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        message: message ?? "All notifications deleted",
        data: data,
      });
    } catch (err: any) {
      logger.error(
        `Request ID:${req.headers["x-request-id"]} | error: ${err?.message ?? err}`
      );
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        message: err?.message ?? "Failed to delete notifications",
      });
    }
  }

  public async getUnreadCount(req: Request, res: Response) {
    try {
      const userId = req.userId;
      
      if (!userId) {
        return res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: "Bad Request",
        });
      }

      const { data, message } = await this.notificationService.getUnreadCount(userId);
      
      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        message: message ?? "OK",
        data: data,
      });
    } catch (err: any) {
      logger.error(
        `Request ID:${req.headers["x-request-id"]} | error: ${err?.message ?? err}`
      );
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        message: err?.message ?? "Failed to get unread count",
      });
    }
  }

  public async sendNotification(req: Request, res: Response) {
    try {
      const { recipientType, userId, recipientValue, title, body, type, data, imageUrl, actionUrl, deviceToken } = req.body;
      
      if (!recipientType || !title || !body || !type) {
        return res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: "Missing required fields: recipientType, title, body, type",
        });
      }

      const result = await this.notificationService.sendNotification({
        recipientType,
        userId,
        recipientValue,
        title,
        body,
        type,
        data,
        imageUrl,
        actionUrl,
        deviceToken,
      });
      
      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        message: result.message ?? "Notification sent",
        data: result.data,
      });
    } catch (err: any) {
      logger.error(
        `Request ID:${req.headers["x-request-id"]} | error: ${err?.message ?? err}`
      );
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        message: err?.message ?? "Failed to send notification",
      });
    }
  }

  public async sendBulkNotifications(req: Request, res: Response) {
    try {
      const { notifications } = req.body;
      
      if (!Array.isArray(notifications) || notifications.length === 0) {
        return res.status(STATUS_CODE.BAD_REQUEST).json({
          success: false,
          message: "notifications must be a non-empty array",
        });
      }

      const result = await this.notificationService.sendBulkNotifications(notifications);
      
      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        message: result.message,
        data: result.data,
      });
    } catch (err: any) {
      logger.error(
        `Request ID:${req.headers["x-request-id"]} | error: ${err?.message ?? err}`
      );
      return res.status(STATUS_CODE.INTERNAL_SERVER).json({
        success: false,
        message: err?.message ?? "Failed to send bulk notifications",
      });
    }
  }
}
