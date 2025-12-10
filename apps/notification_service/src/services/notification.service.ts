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
      if (!payload?.title || !payload?.body || !payload?.type || !payload?.recipientType) {
        throw new BadRequestError("Missing required notification fields: title, body, type, recipientType");
      }

      // Validate recipient based on type
      if (payload.recipientType === 'user_id' && !payload.userId) {
        throw new BadRequestError("userId is required when recipientType is 'user_id'");
      }
      if ((payload.recipientType === 'email' || payload.recipientType === 'phone') && !payload.recipientValue) {
        throw new BadRequestError("recipientValue is required when recipientType is 'email' or 'phone'");
      }

      // Use provided userId or null for email/phone recipients
      let targetUserId = payload.userId || null;

      const notification = await this.notificationRepo.create({
        userId: targetUserId,
        recipientType: payload.recipientType,
        recipientValue: payload.recipientValue || null,
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

      // Handle different recipient types
      let token = payload.deviceToken;
      
      // Try to get device token for user_id notifications
      if (!token && payload.recipientType === 'user_id' && payload.userId) {
        const deviceToken = await this.getUserDeviceToken(payload.userId);
        token = deviceToken || undefined;
      }
      
      // For email/phone, try to find user and get device token
      if (!token && (payload.recipientType === 'email' || payload.recipientType === 'phone')) {
        const userId = await this.findUserByContact(payload.recipientType, payload.recipientValue!);
        if (userId) {
          const deviceToken = await this.getUserDeviceToken(userId);
          token = deviceToken || undefined;
          // Update notification with found userId
          await this.notificationRepo.updateNotificationUserId(notification.id, userId);
        } else {
          logger.warn(`User not found for ${payload.recipientType}: ${payload.recipientValue}. Notification saved to DB only.`);
        }
      }
      
      // Handle all_users broadcast
      if (payload.recipientType === 'all_users') {
        const deviceTokens = await this.getAllActiveDeviceTokens();
        if (deviceTokens.length > 0) {
          try {
            const client = this.getClient();
            const results = await Promise.allSettled(
              deviceTokens.map(deviceToken => 
                client.send(deviceToken, { 
                  ...payload, 
                  userId: payload.userId || 'broadcast',
                  recipientType: payload.recipientType,
                  recipientValue: payload.recipientValue
                })
              )
            );
            
            const successful = results.filter(r => r.status === "fulfilled").length;
            await this.notificationRepo.updateSentStatus(notification.id, true, null);
            logger.info(`Broadcast notification sent to ${successful}/${deviceTokens.length} devices`);
            return { data: notification, message: `Broadcast sent to ${successful} devices` };
          } catch (broadcastErr: any) {
            logger.error(`Failed to send broadcast notification: ${broadcastErr?.message}`);
            await this.notificationRepo.updateSentStatus(notification.id, false, broadcastErr?.message);
            return { data: notification, message: "Broadcast notification saved but failed to send" };
          }
        } else {
          logger.info('No active device tokens found for broadcast');
          await this.notificationRepo.updateSentStatus(notification.id, true, 'No active devices');
          return { data: notification, message: "Broadcast notification saved (no active devices)" };
        }
      }

      if (!token) {
        const recipient = payload.recipientType === 'user_id' ? payload.userId : payload.recipientValue;
        const message = `No device token for ${payload.recipientType}: ${recipient}, notification saved to DB only`;
        logger.info(message);
        return { data: notification, message: message };
      }

      try {
        const client = this.getClient();
        const result = await client.send(token, { ...payload, userId: payload.userId || 'unknown' });
        await this.notificationRepo.updateSentStatus(notification.id, true, null);
        const recipient = payload.recipientType === 'user_id' ? payload.userId : payload.recipientValue;
        logger.info(`Notification sent to ${payload.recipientType}: ${recipient}, messageId: ${result.messageId}`);
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

  public async getAllNotifications(limit = 50, offset = 0) {
    try {
      const notifications = await this.notificationRepo.findAll(limit, offset);
      return { data: { notifications: notifications.items, total: notifications.total }, message: "OK" };
    }
    catch (err: any) {
      logger.error(`NotificationService.getAllNotifications error: ${err?.message ?? err}`);
      throw new ServerError(err?.message ?? "Failed to fetch all notifications");
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

  /**
   * Get device token for a user by userId
   */
  public async getUserDeviceToken(userId: string): Promise<string | null> {
    try {
      const response = await axios.get(`${ServerConfigs.USER_SERVICE_URL}/api/v1/user/${userId}`);
      return response.data?.data?.deviceToken || null;
    } catch (err: any) {
      logger.error(`Failed to get device token for user ${userId}: ${err?.message}`);
      return null;
    }
  }

  /**
   * Find user by email or phone contact using internal endpoints
   */
  public async findUserByContact(type: 'email' | 'phone', value: string): Promise<string | null> {
    try {
      const endpoint = type === 'email' 
        ? `${ServerConfigs.USER_SERVICE_URL}/api/v1/internal/user/by-email/${encodeURIComponent(value)}`
        : `${ServerConfigs.USER_SERVICE_URL}/api/v1/internal/user/by-phone/${encodeURIComponent(value)}`;
        
      const response = await axios.get(endpoint);
      return response.data?.data?.userId || null;
    } catch (err: any) {
      if (err.response?.status === 404) {
        logger.info(`User not found by ${type}: ${value}`);
        return null;
      }
      logger.error(`Failed to find user by ${type}: ${value}, error: ${err?.message}`);
      return null;
    }
  }

  /**
   * Get all active device tokens for broadcast notifications
   */
  public async getAllActiveDeviceTokens(): Promise<string[]> {
    try {
      const response = await axios.get(`${ServerConfigs.USER_SERVICE_URL}/api/v1/internal/device-tokens`);
      return response.data?.data?.deviceTokens || [];
    } catch (err: any) {
      logger.error(`Failed to get all device tokens: ${err?.message}`);
      return [];
    }
  }
}
