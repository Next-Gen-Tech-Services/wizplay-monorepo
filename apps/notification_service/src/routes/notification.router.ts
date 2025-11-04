// src/routes/notification.router.ts
import { Router, type Router as RouterType } from "express";
import "reflect-metadata";
import { container } from "tsyringe";
import NotificationController from "../controllers/notification.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router: RouterType = Router();
const controller: NotificationController = container.resolve(NotificationController);

/**
 * Get user notifications
 */
router.get("/notifications", requireAuth, async (req, res) => {
  return await controller.getNotifications(req, res);
});

/**
 * Mark notification as read
 */
router.patch("/notifications/:id/read", requireAuth, async (req, res) => {
  return await controller.markAsRead(req, res);
});

/**
 * Mark all notifications as read
 */
router.patch("/notifications/read-all", requireAuth, async (req, res) => {
  return await controller.markAllAsRead(req, res);
});

export default router;
