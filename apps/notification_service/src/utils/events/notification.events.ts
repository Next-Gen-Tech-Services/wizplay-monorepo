// src/utils/events/notification.events.ts
import { logger } from "@repo/common";
import { container } from "tsyringe";
import NotificationService from "../../services/notification.service";
import { kafkaClient } from "../kafka";
import { KAFKA_EVENTS } from "../../types";
import { NotificationPayload } from "@repo/notifications";

class NotificationEventHandler {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = container.resolve(NotificationService);
  }

  public async handle(): Promise<void> {
    try {
      await kafkaClient.subscribeMultiple(
        async (message: any) => {
          try {
            const isWrapped = typeof message === "object" && "event" in message;
            if (isWrapped && message.event !== KAFKA_EVENTS.NOTIFICATION_SEND) return;

            const payload: NotificationPayload & { deviceToken?: string } = isWrapped
              ? (message.data as any)
              : (message as any);

            if (!payload || !payload.userId) return;

            logger.info(`notification.event received for userId=${payload.userId}`);

            if (!payload.deviceToken) {
              const token = await this.notificationService.getUserDeviceToken(payload.userId);
              if (token) payload.deviceToken = token;
            }

            await this.notificationService.sendNotification(payload);
          } catch (err: any) {
            logger.error(`notification.event error: ${err?.message ?? err}`);
          }
        },
        [KAFKA_EVENTS.NOTIFICATION_SEND]
      );

      logger.info("notification event handler initialized");
    } catch (err: any) {
      logger.error(`failed to initialize notification handler: ${err?.message ?? err}`);
      throw err;
    }
  }
}

export default new NotificationEventHandler();
