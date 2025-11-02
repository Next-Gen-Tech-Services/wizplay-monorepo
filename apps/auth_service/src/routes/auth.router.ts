import { validateRequest } from "@repo/common";
import { Request, Response, Router } from "express";
import { body } from "express-validator";
import "reflect-metadata";
import { container } from "tsyringe";
import AuthController from "../controllers/auth.controller";
import {
  authCodeValidator,
  emailPassValidator,
  emailValidator,
  phoneValidator,
  resetPassValidator,
} from "../validators";

const router = Router();
const controller: AuthController = container.resolve(AuthController);

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

//  VERIFY OTP ROUTE
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
    body("referralCode")
      .optional()
      .isString()
      .isLength({ min: 3, max: 20 })
      .withMessage("Invalid referral code"),
  ],
  validateRequest,
  async (req: Request, res: Response) =>
    controller.verifyOtpController(req, res)
);

// EMAIL-PASS-LOGIN ROUTE
router.post(
  "/auth/login",
  emailPassValidator(),
  validateRequest,
  async (req: Request, res: Response) => {
    const result = await controller.loginWithEmailPass(req, res);
    return result;
  }
);

// FORGET PASSWORD ROUTE
router.post(
  "/auth/forget",
  emailValidator(),
  validateRequest,
  async (req: Request, res: Response) => {
    const result = await controller.forgetPassword(req, res);
    return result;
  }
);

// RESET PASSWORD ROUTE
router.patch(
  "/auth/reset",
  resetPassValidator(),
  validateRequest,
  async (req: Request, res: Response) => {
    const result = await controller.resetPassword(req, res);
    return result;
  }
);

// GOOGLE LOGIN ROUTE
router.post(
  "/auth/google",
  authCodeValidator(),
  validateRequest,
  async (req: Request, res: Response) => {
    const result = await controller.authWithGoogle(req, res);
    return result;
  }
);

export default router;
