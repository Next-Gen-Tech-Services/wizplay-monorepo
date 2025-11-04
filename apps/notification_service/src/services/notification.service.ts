// src/services/notification.service.ts
import { logger } from "@repo/common";
import { autoInjectable } from "tsyringe";
import { getNotificationClient, NotificationPayload} from "@repo/notifications";
import ServerConfigs from "../configs/server.config";
import NotificationRepository from "../repositories/notification.repository";
import axios from "axios";

@autoInjectable()
export default class NotificationService {
  private notificationClient = getNotificationClient({
    projectId: ServerConfigs.FIREBASE_PROJECT_ID,
    privateKey: ServerConfigs.FIREBASE_PRIVATE_KEY,
    clientEmail: ServerConfigs.FIREBASE_CLIENT_EMAIL,
  });

  constructor(private readonly notificationRepo: NotificationRepository) {}

  /**
   * Send notification and save to database
   */
  public async sendNotification(payload: NotificationPayload & { deviceToken?: string }) {
    try {
      // Save to database first
      const notification = await this.notificationRepo.create({
        userId: payload.userId,
        title: payload.title,
        body: payload.body,
        type: payload.type,
        data: payload.data || {},
        imageUrl: payload.imageUrl,
        actionUrl: payload.actionUrl,
        deviceToken: payload.deviceToken,
        isSent: false,
        isRead: false,
      });

      // If device token provided, send via Firebase
      if (payload.deviceToken) {
        try {
          const result = await this.notificationClient.send(payload.deviceToken, payload);

          // Update sent status
          await this.notificationRepo.updateSentStatus(
            notification.id,
            result.success,
            result.error
          );

          logger.info(`Notification sent to user ${payload.userId}: ${result.messageId}`);
        } catch (sendErr: any) {
          logger.error(`Failed to send notification: ${sendErr?.message}`);
          await this.notificationRepo.updateSentStatus(
            notification.id,
            false,
            sendErr?.message
          );
        }
      } else {
        logger.warn(`No device token for user ${payload.userId}, notification saved to DB only`);
      }

      return notification;
    } catch (err: any) {
      logger.error(`NotificationService.sendNotification error: ${err?.message ?? err}`);
      throw err;
    }
  }

  /**
   * Get user notifications
   */
  public async getUserNotifications(userId: string, limit = 50, offset = 0) {
    try {
      const notifications = await this.notificationRepo.findByUserId(userId, limit, offset);
      const unreadCount = await this.notificationRepo.countUnread(userId);

      return {
        notifications,
        unreadCount,
        total: notifications.length,
      };
    } catch (err: any) {
      logger.error(`NotificationService.getUserNotifications error: ${err?.message ?? err}`);
      throw err;
    }
  }

  /**
   * Mark notification as read
   */
  public async markAsRead(notificationId: string) {
    try {
      return await this.notificationRepo.markAsRead(notificationId);
    } catch (err: any) {
      logger.error(`NotificationService.markAsRead error: ${err?.message ?? err}`);
      throw err;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  public async markAllAsRead(userId: string) {
    try {
      return await this.notificationRepo.markAllAsRead(userId);
    } catch (err: any) {
      logger.error(`NotificationService.markAllAsRead error: ${err?.message ?? err}`);
      throw err;
    }
  }

  /**
   * Get device token from user service
   */
  public async getUserDeviceToken(userId: string): Promise<string | null> {
    try {
      const response = await axios.get(
        `${ServerConfigs.USER_SERVICE_URL}/api/v1/user/${userId}`,
        { timeout: 3000 }
      );

      if (response.data?.success && response.data.data?.deviceToken) {
        return response.data.data.deviceToken;
      }

      return null;
    } catch (err: any) {
      logger.warn(`Failed to get device token for user ${userId}: ${err?.message}`);
      return null;
    }
  }

  /**
   * Delete old notifications (cleanup job)
   */
  public async cleanupOldNotifications(daysOld: number = 30) {
    try {
      const deleted = await this.notificationRepo.deleteOld(daysOld);
      logger.info(`Deleted ${deleted} old notifications`);
      return deleted;
    } catch (err: any) {
      logger.error(`NotificationService.cleanupOldNotifications error: ${err?.message ?? err}`);
      throw err;
    }
  }
}
