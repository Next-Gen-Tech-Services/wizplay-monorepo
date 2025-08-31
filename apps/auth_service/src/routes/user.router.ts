import { Request, Response, Router } from "express";
import "reflect-metadata";
import { container } from "tsyringe";
import UserController from "../controllers/user.controller";

const router = Router();
const controller: UserController = container.resolve(UserController);

// TEST-ROUTE
router.get("/user/test-route", (req: Request, res: Response) =>
  controller.testResponse(req, res),
);

// GOOGLE-LOGIN ROUTE
router.post("/google", (req: Request, res: Response) => {
  return res.json({
    "status": "ok"
  })
})

// APPLE-LOGIN ROUTE
router.post("/apple", (req: Request, res: Response) => {
  return res.json({
    "status": "ok"
  })
})

// GENERATE OTP ROUTE
router.post("/otp", (req: Request, res: Response) => {

})




export default router;
