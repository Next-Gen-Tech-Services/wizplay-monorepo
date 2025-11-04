// src/controllers/notification.controller.ts
import { logger, STATUS_CODE } from "@repo/common";
import { Request, Response } from "express";
import { autoInjectable } from "tsyringe";
import NotificationService from "../services/notification.service";

@autoInjectable()
export default class NotificationController {
    constructor(private readonly notificationService: NotificationService) { }

    /**
     * GET /notifications - Get user notifications
     */
    public async getNotifications(req: Request, res: Response) {
        try {
            const userId = req.userId!;
            const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
            const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

            const result = await this.notificationService.getUserNotifications(
                userId,
                limit,
                offset
            );

            return res.status(STATUS_CODE.SUCCESS).json({
                success: true,
                data: result,
                timestamp: new Date().toISOString(),
            });
        } catch (err: any) {
            logger.error(`NotificationController.getNotifications error: ${err?.message ?? err}`);
            return res.status(STATUS_CODE.INTERNAL_SERVER).json({
                success: false,
                message: "Failed to fetch notifications",
                timestamp: new Date().toISOString(),
            });
        }
    }

    /**
     * PATCH /notifications/:id/read - Mark notification as read
     */
  public async markAsRead(req: Request, res: Response) {
    try {
      const notificationId = req.params.id as string;

      const updated = await this.notificationService.markAsRead(notificationId);            if (!updated) {
                return res.status(STATUS_CODE.NOT_FOUND).json({
                    success: false,
                    message: "Notification not found",
                    timestamp: new Date().toISOString(),
                });
            }

            return res.status(STATUS_CODE.SUCCESS).json({
                success: true,
                message: "Notification marked as read",
                timestamp: new Date().toISOString(),
            });
        } catch (err: any) {
            logger.error(`markAsRead error: ${err?.message}`);
            return res.status(STATUS_CODE.INTERNAL_SERVER).json({
                success: false,
                message: "Failed to mark notification as read",
                error: err?.message,
                timestamp: new Date().toISOString(),
            });
        }
    }

    /**
     * PATCH /notifications/read-all - Mark all notifications as read
     */
    public async markAllAsRead(req: Request, res: Response) {
        try {
            const userId = req.userId || "";

            const updated = await this.notificationService.markAllAsRead(userId);

            return res.status(STATUS_CODE.SUCCESS).json({
                success: true,
                message: `Marked ${updated} notifications as read`,
                timestamp: new Date().toISOString(),
            });
        } catch (err: any) {
            logger.error(`markAllAsRead error: ${err?.message}`);
            return res.status(STATUS_CODE.INTERNAL_SERVER).json({
                success: false,
                message: "Failed to mark notifications as read",
                error: err?.message,
                timestamp: new Date().toISOString(),
            });
        }
    }
}
