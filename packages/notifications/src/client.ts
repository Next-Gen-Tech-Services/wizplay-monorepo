// packages/notifications/src/client.ts
import * as admin from 'firebase-admin';
import {
  FirebaseConfig,
  NotificationPayload,
  SendNotificationResult,
  BulkNotificationPayload,
} from './types';

export class NotificationClient {
  private app: admin.app.App | null = null;
  private initialized = false;

  constructor(config?: FirebaseConfig) {
    if (config) {
      this.initialize(config);
    }
  }

  /**
   * Initialize Firebase Admin SDK
   */
  public initialize(config: FirebaseConfig): void {
    if (this.initialized) {
      console.warn('Firebase already initialized');
      return;
    }

    try {
      // Validate config
      if (!config.projectId || !config.privateKey || !config.clientEmail) {
        throw new Error('Invalid Firebase configuration: projectId, privateKey, and clientEmail are required');
      }

      this.app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: config.projectId,
          privateKey: config.privateKey.replace(/\\n/g, '\n'),
          clientEmail: config.clientEmail,
        }),
      });
      this.initialized = true;
      console.log('✅ Firebase Admin SDK initialized');
    } catch (error: any) {
      console.error('❌ Failed to initialize Firebase:', error.message);
      throw error;
    }
  }

  /**
   * Send notification to a single user
   */
  public async send(
    deviceToken: string,
    payload: NotificationPayload
  ): Promise<SendNotificationResult> {
    if (!this.initialized || !this.app) {
      throw new Error('Firebase not initialized. Call initialize() first.');
    }

    try {
      const message: admin.messaging.Message = {
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: {
          type: payload.type,
          userId: payload.userId,
          ...(payload.data || {}),
          actionUrl: payload.actionUrl || '',
        },
        token: deviceToken,
        android: {
          priority: payload.priority === 'high' ? 'high' : 'normal',
          notification: {
            sound: 'default',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const messageId = await admin.messaging().send(message);
      
      return {
        success: true,
        messageId,
      };
    } catch (error: any) {
      console.error('Failed to send notification:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send notification to multiple users
   */
  public async sendBulk(
    deviceTokens: string[],
    payload: BulkNotificationPayload
  ): Promise<SendNotificationResult[]> {
    if (!this.initialized || !this.app) {
      throw new Error('Firebase not initialized. Call initialize() first.');
    }

    const results: SendNotificationResult[] = [];

    try {
      const messages: admin.messaging.Message[] = deviceTokens.map((token) => ({
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: {
          type: payload.type,
          ...(payload.data || {}),
        },
        token,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      }));

      const response = await admin.messaging().sendEach(messages);

      response.responses.forEach((resp, idx) => {
        if (resp.success) {
          results.push({
            success: true,
            messageId: resp.messageId,
          });
        } else {
          results.push({
            success: false,
            error: resp.error?.message || 'Unknown error',
          });
        }
      });

      return results;
    } catch (error: any) {
      console.error('Failed to send bulk notifications:', error.message);
      throw error;
    }
  }

  /**
   * Send to topic (for broadcast messages)
   */
  public async sendToTopic(
    topic: string,
    payload: Omit<NotificationPayload, 'userId'>
  ): Promise<SendNotificationResult> {
    if (!this.initialized || !this.app) {
      throw new Error('Firebase not initialized. Call initialize() first.');
    }

    try {
      const message: admin.messaging.Message = {
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: {
          type: payload.type,
          ...(payload.data || {}),
        },
        topic,
        android: {
          priority: payload.priority === 'high' ? 'high' : 'normal',
        },
      };

      const messageId = await admin.messaging().send(message);

      return {
        success: true,
        messageId,
      };
    } catch (error: any) {
      console.error('Failed to send topic notification:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Subscribe user to topic
   */
  public async subscribeToTopic(
    deviceTokens: string | string[],
    topic: string
  ): Promise<void> {
    if (!this.initialized || !this.app) {
      throw new Error('Firebase not initialized. Call initialize() first.');
    }

    const tokens = Array.isArray(deviceTokens) ? deviceTokens : [deviceTokens];

    try {
      await admin.messaging().subscribeToTopic(tokens, topic);
      console.log(`Subscribed ${tokens.length} device(s) to topic: ${topic}`);
    } catch (error: any) {
      console.error('Failed to subscribe to topic:', error.message);
      throw error;
    }
  }

  /**
   * Unsubscribe user from topic
   */
  public async unsubscribeFromTopic(
    deviceTokens: string | string[],
    topic: string
  ): Promise<void> {
    if (!this.initialized || !this.app) {
      throw new Error('Firebase not initialized. Call initialize() first.');
    }

    const tokens = Array.isArray(deviceTokens) ? deviceTokens : [deviceTokens];

    try {
      await admin.messaging().unsubscribeFromTopic(tokens, topic);
      console.log(`Unsubscribed ${tokens.length} device(s) from topic: ${topic}`);
    } catch (error: any) {
      console.error('Failed to unsubscribe from topic:', error.message);
      throw error;
    }
  }
}

// Singleton instance
let notificationClient: NotificationClient | null = null;

export const getNotificationClient = (config?: FirebaseConfig): NotificationClient => {
  if (!notificationClient) {
    notificationClient = new NotificationClient(config);
  }
  return notificationClient;
};
