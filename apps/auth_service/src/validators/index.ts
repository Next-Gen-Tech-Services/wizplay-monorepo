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
