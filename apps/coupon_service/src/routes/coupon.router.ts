// src/routes/coupons.routes.ts
import { validateRequest } from "@repo/common";
import { Request, Response, Router } from "express";
import { body, param, query } from "express-validator";
import "reflect-metadata";
import { container } from "tsyringe";
import CouponController from "../controllers/coupon.controller";
import { assignCouponsValidatorDetailed } from "@/validators";

const router = Router();
const controller: CouponController = container.resolve(CouponController);

/**
 * Validators
 */
const createCouponValidator = () => [
  body("code").isString().notEmpty().withMessage("code is required"),
  body("title").isString().notEmpty().withMessage("title is required"),
  body("platform").isString().notEmpty().withMessage("platform is required"),
  body("discountType")
    .isIn(["flat", "percent"])
    .withMessage("discountType must be 'flat' or 'percent'"),
  body("discountValue")
    .isNumeric()
    .custom((v) => v >= 0)
    .withMessage("discountValue must be >= 0"),
  body("purchaseAmount")
    .optional()
    .isNumeric()
    .withMessage("purchaseAmount must be a number"),
  body("expiry").isISO8601().withMessage("expiry must be a valid ISO date"),
  body("status")
    .optional()
    .isIn(["active", "expired", "used", "inactive"])
    .withMessage("invalid status"),
  body("maxUsePerUser")
    .optional()
    .isInt({ min: 1 })
    .withMessage("must be integer >= 1"),
];

const updateCouponValidator = () => [
  body("code").optional().isString(),
  body("title").optional().isString(),
  body("platform").optional().isString(),
  body("discountType").optional().isIn(["flat", "percent"]),
  body("discountValue")
    .optional()
    .isNumeric()
    .custom((v) => v >= 0),
  body("minOrderValue").optional().isNumeric(),
  body("expiry").optional().isISO8601(),
  body("status").optional().isIn(["active", "expired", "used", "inactive"]),
  body("maxUsePerUser").optional().isInt({ min: 1 }),
];

const idParamValidator = () => [param("id").isUUID().withMessage("invalid id")];

/**
 * Routes
 */

/**
 * List coupons with optional filters:
 *  - ?search=...&status=...&platform=...&limit=10&offset=0
 */
router.get(
  "/",
  [
    query("search").optional().isString(),
    query("status")
      .optional()
      .isIn(["all", "active", "expired", "used", "inactive"]),
    query("platform").optional().isString(),
    query("limit").optional().toInt().isInt({ min: 1 }),
    query("offset").optional().toInt().isInt({ min: 0 }),
    validateRequest,
  ],
  (req: Request, res: Response) => controller.list(req, res)
);

// Get single coupon
router.get(
  "/:id",
  idParamValidator(),
  validateRequest,
  (req: Request, res: Response) => controller.getOne(req, res)
);

// Create coupon (admin-only in production; attach requireAdmin middleware if available)
router.post(
  "/",
  createCouponValidator(),
  validateRequest,
  (req: Request, res: Response) => controller.create(req, res)
);

// Update coupon
router.patch(
  "/:id",
  [...idParamValidator(), ...updateCouponValidator(), validateRequest],
  (req: Request, res: Response) => controller.update(req, res)
);

// Toggle active/inactive
router.post(
  "/:id/toggle",
  idParamValidator(),
  validateRequest,
  (req: Request, res: Response) => controller.toggleActive(req, res)
);

// Delete coupon
router.delete(
  "/:id",
  idParamValidator(),
  validateRequest,
  (req: Request, res: Response) => controller.remove(req, res)
);

// assign coupon to contest
router.post("/auto/assign", async (req: Request, res: Response) => {
  const result = await controller.assignCoupons(req, res);
  return result;
});

// assign coupon to contest
router.post("/assign", assignCouponsValidatorDetailed(),
  validateRequest, async (req: Request, res: Response) => {
    const result = await controller.assignMannualCoupons(req, res);
    return result;
  });

export default router;
