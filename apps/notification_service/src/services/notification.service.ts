// src/services/notification.service.ts
import { BadRequestError, ServerError, logger } from "@repo/common";
import { autoInjectable } from "tsyringe";
import { getNotificationClient, NotificationPayload } from "@repo/notifications";
import ServerConfigs from "../configs/server.config";
import axios from "axios";
import NotificationRepository from "../repositories/notification.repository";

@autoInjectable()
export default class NotificationService {
  private notificationClient?: ReturnType<typeof getNotificationClient>;

  constructor(private readonly notificationRepo: NotificationRepository) {}

  private getClient() {
    if (!this.notificationClient) {
      if (!ServerConfigs.FIREBASE_PROJECT_ID || !ServerConfigs.FIREBASE_PRIVATE_KEY || !ServerConfigs.FIREBASE_CLIENT_EMAIL) {
        throw new BadRequestError("Firebase credentials are not configured");
      }
      this.notificationClient = getNotificationClient({
        projectId: ServerConfigs.FIREBASE_PROJECT_ID,
        privateKey: ServerConfigs.FIREBASE_PRIVATE_KEY,
        clientEmail: ServerConfigs.FIREBASE_CLIENT_EMAIL,
      });
    }
    return this.notificationClient;
  }

  public async sendNotification(payload: NotificationPayload & { deviceToken?: string }) {
    try {
      if (!payload?.userId || !payload?.title || !payload?.body || !payload?.type) {
        throw new BadRequestError("Missing required notification fields");
      }

      const notification = await this.notificationRepo.create({
        userId: payload.userId,
        title: payload.title,
        body: payload.body,
        type: payload.type,
        data: payload.data || {},
        imageUrl: payload.imageUrl ?? null,
        actionUrl: payload.actionUrl ?? null,
        deviceToken: payload.deviceToken ?? null,
        isSent: false,
        isRead: false,
      });

      const token = payload.deviceToken ?? (await this.getUserDeviceToken(payload.userId));
      if (!token) {
        logger.warn(`No device token for user ${payload.userId}, notification saved to DB only`);
        return { data: notification, message: "Notification saved without device token" };
      }

      try {
        const client = this.getClient();
        const result = await client.send(token, { ...payload, userId: payload.userId });
        await this.notificationRepo.updateSentStatus(notification.id, true, null);
        logger.info(`Notification sent to user ${payload.userId}: ${result.messageId}`);
      } catch (sendErr: any) {
        logger.error(`Failed to send notification: ${sendErr?.message}`);
        await this.notificationRepo.updateSentStatus(notification.id, false, sendErr?.message);
      }

      return { data: notification, message: "Notification processed" };
    } catch (err: any) {
      logger.error(`NotificationService.sendNotification error: ${err?.message ?? err}`);
      throw new ServerError(err?.message ?? "Notification send failed");
    }
  }

  public async getUserNotifications(userId: string, limit = 50, offset = 0) {
    try {
      const notifications = await this.notificationRepo.findByUserId(userId, limit, offset);
      const unreadCount = await this.notificationRepo.countUnread(userId);
      return { data: { notifications, unreadCount, total: notifications.length }, message: "OK" };
    } catch (err: any) {
      logger.error(`NotificationService.getUserNotifications error: ${err?.message ?? err}`);
      throw new ServerError(err?.message ?? "Failed to fetch notifications");
    }
  }

  public async markAsRead(notificationId: string) {
    try {
      const res = await this.notificationRepo.markAsRead(notificationId);
      return { data: res, message: "Marked as read" };
    } catch (err: any) {
      logger.error(`NotificationService.markAsRead error: ${err?.message ?? err}`);
      throw new ServerError(err?.message ?? "Failed to mark as read");
    }
  }

  public async markAllAsRead(userId: string) {
    try {
      const res = await this.notificationRepo.markAllAsRead(userId);
      return { data: res, message: "All marked as read" };
    } catch (err: any) {
      logger.error(`NotificationService.markAllAsRead error: ${err?.message ?? err}`);
      throw new ServerError(err?.message ?? "Failed to mark all as read");
    }
  }

  public async getNotificationById(notificationId: string, userId: string) {
    try {
      const notification = await this.notificationRepo.findById(notificationId);
      if (!notification) {
        throw new BadRequestError("Notification not found");
      }
      if (notification.userId !== userId) {
        throw new BadRequestError("Unauthorized access to notification");
      }
      return { data: notification, message: "OK" };
    } catch (err: any) {
      logger.error(`NotificationService.getNotificationById error: ${err?.message ?? err}`);
      throw new ServerError(err?.message ?? "Failed to fetch notification");
    }
  }

  public async deleteNotification(notificationId: string, userId: string) {
    try {
      const notification = await this.notificationRepo.findById(notificationId);
      if (!notification) {
        throw new BadRequestError("Notification not found");
      }
      if (notification.userId !== userId) {
        throw new BadRequestError("Unauthorized access to notification");
      }
      await this.notificationRepo.deleteById(notificationId);
      return { data: { deleted: true }, message: "Notification deleted" };
    } catch (err: any) {
      logger.error(`NotificationService.deleteNotification error: ${err?.message ?? err}`);
      throw new ServerError(err?.message ?? "Failed to delete notification");
    }
  }

  public async deleteAllNotifications(userId: string) {
    try {
      const count = await this.notificationRepo.deleteByUserId(userId);
      return { data: { deletedCount: count }, message: "All notifications deleted" };
    } catch (err: any) {
      logger.error(`NotificationService.deleteAllNotifications error: ${err?.message ?? err}`);
      throw new ServerError(err?.message ?? "Failed to delete notifications");
    }
  }

  public async getUnreadCount(userId: string) {
    try {
      const count = await this.notificationRepo.countUnread(userId);
      return { data: { unreadCount: count }, message: "OK" };
    } catch (err: any) {
      logger.error(`NotificationService.getUnreadCount error: ${err?.message ?? err}`);
      throw new ServerError(err?.message ?? "Failed to get unread count");
    }
  }

  public async sendBulkNotifications(payloads: Array<NotificationPayload & { deviceToken?: string }>) {
    try {
      const results = await Promise.allSettled(
        payloads.map(payload => this.sendNotification(payload))
      );
      
      const successful = results.filter(r => r.status === "fulfilled").length;
      const failed = results.filter(r => r.status === "rejected").length;
      
      return {
        data: { successful, failed, total: payloads.length },
        message: `Sent ${successful}/${payloads.length} notifications`
      };
    } catch (err: any) {
      logger.error(`NotificationService.sendBulkNotifications error: ${err?.message ?? err}`);
      throw new ServerError(err?.message ?? "Failed to send bulk notifications");
    }
  }

  public async getUserDeviceToken(userId: string): Promise<string | null> {
    try {
      const response = await axios.get(`${ServerConfigs.USER_SERVICE_URL}/api/v1/user/${userId}/device-token`);
      return response.data?.deviceToken || null;
    } catch (err: any) {
      logger.error(`Failed to get device token for user ${userId}: ${err?.message}`);
      return null;
    }
  }
}
