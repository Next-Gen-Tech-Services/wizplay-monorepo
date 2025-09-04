import { validateRequest } from "@repo/common";
import { Request, Response, Router } from "express";
import { body } from "express-validator";
import "reflect-metadata";
import { container } from "tsyringe";
import AuthController from "../controllers/auth.controller";
import { phoneValidator } from "../validators";

const router = Router();
const controller: AuthController = container.resolve(AuthController);

// TEST-ROUTE
router.get("/user/test-route", (req: Request, res: Response) =>
  controller.testResponse(req, res)
);

// GOOGLE-LOGIN ROUTE
router.post("/google", (req: Request, res: Response) => {
  return res.json({
    status: "ok",
  });
});

// APPLE-LOGIN ROUTE
router.post("/apple", (req: Request, res: Response) => {
  return res.json({
    status: "ok",
  });
});

// GENERATE OTP ROUTE
router.post(
  "/auth/send-otp",
  phoneValidator(),
  validateRequest,
  async (req: Request, res: Response) => {
    const result = await controller.generateOtpController(req, res);
    return result;
  }
);

router.post(
  "/auth/verify-otp",
  [
    body("phoneNumber")
      .isString()
      .isLength({ min: 8 })
      .withMessage("Invalid phone number"),
    body("otp")
      .isString()
      .isLength({ min: 4, max: 8 })
      .withMessage("Invalid OTP"),
  ],
  validateRequest,
  async (req: Request, res: Response) =>
    controller.verifyOtpController(req, res)
);

export default router;
