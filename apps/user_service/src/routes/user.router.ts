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

export default router;
