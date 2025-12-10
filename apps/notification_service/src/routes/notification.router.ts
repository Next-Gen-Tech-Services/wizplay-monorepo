import { validateRequest } from "@repo/common";
import { Request, Response, Router } from "express";
import "reflect-metadata";
import { container } from "tsyringe";
import NotificationController from "../controllers/notification.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import {
  notificationIdValidator,
  sendBulkNotificationValidator,
  sendNotificationValidator,
} from "../validators";

const router = Router();
const controller: NotificationController = container.resolve(NotificationController);

/**
 * Notification Routes
 */

// Get all user notifications (paginated)
router.get(
  "/notifications",
  requireAuth,
  async (req: Request, res: Response) => {
    const result = await controller.getNotifications(req, res);
    return result;
  }
);

router.get(
  "/notifications/all",
  async (req: Request, res: Response) => {
    const result = await controller.getAllNotifications(req, res);
    return result;
  }
);
// Get unread count
router.get(
  "/notifications/unread/count",
  requireAuth,
  async (req: Request, res: Response) => {
    const result = await controller.getUnreadCount(req, res);
    return result;
  }
);

// Get single notification by ID
router.get(
  "/notifications/:id",
  requireAuth,
  notificationIdValidator(),
  validateRequest,
  async (req: Request, res: Response) => {
    const result = await controller.getNotificationById(req, res);
    return result;
  }
);

// Mark single notification as read
router.patch(
  "/notifications/:id/read",
  requireAuth,
  notificationIdValidator(),
  validateRequest,
  async (req: Request, res: Response) => {
    const result = await controller.markAsRead(req, res);
    return result;
  }
);

// Mark all notifications as read
router.patch(
  "/notifications/read-all",
  requireAuth,
  async (req: Request, res: Response) => {
    const result = await controller.markAllAsRead(req, res);
    return result;
  }
);

// Delete single notification
router.delete(
  "/notifications/:id",
  requireAuth,
  notificationIdValidator(),
  validateRequest,
  async (req: Request, res: Response) => {
    const result = await controller.deleteNotification(req, res);
    return result;
  }
);

// Delete all notifications for user
router.delete(
  "/notifications",
  requireAuth,
  async (req: Request, res: Response) => {
    const result = await controller.deleteAllNotifications(req, res);
    return result;
  }
);

// Send notification (admin or internal service use)
router.post(
  "/notifications/send",
  sendNotificationValidator(),
  validateRequest,
  async (req: Request, res: Response) => {
    const result = await controller.sendNotification(req, res);
    return result;
  }
);

// Send bulk notifications (admin or internal service use)
router.post(
  "/notifications/send-bulk",
  sendBulkNotificationValidator(),
  validateRequest,
  async (req: Request, res: Response) => {
    const result = await controller.sendBulkNotifications(req, res);
    return result;
  }
);

export default router;
