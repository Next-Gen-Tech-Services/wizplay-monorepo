import { Request, Response, Router } from "express";
import "reflect-metadata";
import { container } from "tsyringe";
import NotificationController from "../controllers/notification.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();
const controller: NotificationController = container.resolve(NotificationController);

// Get user notifications
router.get(
  "/notifications",
  requireAuth,
  async (req: Request, res: Response) => {
    const result = await controller.getNotifications(req, res);
    return result;
  }
);
export default router;
