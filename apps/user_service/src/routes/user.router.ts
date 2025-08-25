import "reflect-metadata";
import { container } from "tsyringe";
import UserController from "../controllers/user.controller";
import { Router, Request, Response } from "express";

const router = Router();
const controller: UserController = container.resolve(UserController);

router.get("/user/test-route", (req: Request, res: Response) =>
  controller.testResponse(req, res),
);

export default router;
