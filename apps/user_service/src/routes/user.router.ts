import { validateRequest } from "@repo/common";
import { Request, Response, Router } from "express";
import "reflect-metadata";
import { container } from "tsyringe";
import UserController from "../controllers/user.controller";
import { requireAuth } from "../middlewares/auth.middleware";
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

router.patch(
  "/user/device-token",
  requireAuth,
  async (req: Request, res: Response) => {
    const result = await controller.updateDeviceToken(req, res);
    return result;
  }
);

export default router;
