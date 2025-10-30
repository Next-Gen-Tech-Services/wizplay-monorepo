import { body } from "express-validator";

export const authCodeValidator = () => {
  return [
    body("auth_code").trim().exists().withMessage("auth_code must be valid"),
  ];
};

export const phoneValidator = () => {
  return [
    body("phoneNumber")
      .matches(/^(\+91[\-\s]?)?[6-9]\d{9}$/)
      .withMessage("invalid phone number"),
  ];
};

export const emailPassValidator = () => {
  return [
    body("email").trim().isEmail().withMessage("invalid credentials"),
    body("password").trim().exists().withMessage("invalid credentials"),
  ];
};

export const emailValidator = () => {
  return [body("email").trim().isEmail().withMessage("invalid email")];
};

export const resetPassValidator = () => {
  return [
    body("email").trim().isEmail().withMessage("invalid email"),
    body("password").trim().exists().withMessage("invalid password"),
    body("token").trim().exists().withMessage("invalid reset token"),
  ];
};

/**
 * Alternative validator with more granular field-level validation
 * Use this if you prefer individual field error messages
 */
export const assignCouponsValidatorDetailed = () => {
  return [
    body()
      .isArray({ min: 1, max: 1000 })
      .withMessage("Body must be an array with 1-1000 items")
      .bail(),
    
    body("*.couponId")
      .exists()
      .withMessage("couponId is required")
      .isString()
      .withMessage("couponId must be a string")
      .trim()
      .notEmpty()
      .withMessage("couponId cannot be empty")
      .isUUID()
      .withMessage("couponId must be a valid UUID"),
    
    body("*.contestId")
      .exists()
      .withMessage("contestId is required")
      .isString()
      .withMessage("contestId must be a string")
      .trim()
      .notEmpty()
      .withMessage("contestId cannot be empty")
      .isUUID()
      .withMessage("contestId must be a valid UUID"),
    
    body("*.matchId")
      .optional()
      .isString()
      .withMessage("matchId must be a string")
      .trim()
      .isUUID()
      .withMessage("matchId must be a valid UUID"),
    
    body("*.rank")
      .optional()
      .isInt({ min: 1 })
      .withMessage("rank must be a positive integer"),
  ];
};
