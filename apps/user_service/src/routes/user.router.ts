import { validateRequest } from "@repo/common";
import { Request, Response, Router } from "express";
import "reflect-metadata";
import { container } from "tsyringe";
import UserController from "../controllers/user.controller";
import { requireAuth, requireAdminAuth } from "../middlewares/auth.middleware";
import { updateNameValidator } from "../validators";

const router = Router();
const controller: UserController = container.resolve(UserController);

router.patch(
  "/user",
  requireAuth,
  updateNameValidator(),
  validateRequest,
  async (req: Request, res: Response) => {
    const result = await controller.update(req, res);
    return result;
  }
);

router.get("/user", requireAuth, async (req: Request, res: Response) => {
  const result = await controller.getUser(req, res);
  return result;
});

router.get(
  "/user/get-all-users",
  requireAuth,
  async (req: Request, res: Response) => {
    const result = await controller.getAll(req, res);
    return result;
  }
);

// Public endpoint for fetching user by ID (for inter-service communication)
router.get("/user/:userId", async (req: Request, res: Response) => {
  const result = await controller.getUserById(req, res);
  return result;
});

// Service-to-service endpoint for finding user by email (for notifications)
router.get("/internal/user/by-email/:email", async (req: Request, res: Response) => {
  const result = await controller.getUserByEmail(req, res);
  return result;
});

// Service-to-service endpoint for finding user by phone (for notifications)
router.get("/internal/user/by-phone/:phone", async (req: Request, res: Response) => {
  const result = await controller.getUserByPhone(req, res);
  return result;
});

// Service-to-service endpoint for getting all device tokens (for broadcast notifications)
router.get("/internal/device-tokens", async (req: Request, res: Response) => {
  const result = await controller.getAllDeviceTokens(req, res);
  return result;
});

router.patch(
  "/user/device-token",
  requireAuth,
  async (req: Request, res: Response) => {
    const result = await controller.updateDeviceToken(req, res);
    return result;
  }
);

// Admin endpoint for updating user status
router.patch(
  "/admin/user/:userId/status",
  requireAdminAuth,
  async (req: Request, res: Response) => {
    const result = await controller.updateUserStatus(req, res);
    return result;
  }
);

export default router;
