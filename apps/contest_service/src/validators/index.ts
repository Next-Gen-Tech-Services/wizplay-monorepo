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

export const generateQuestionsValidator = () => {
  return [
    body("matchData").exists().withMessage("invalid match data"),
    body("contestDescription")
      .exists()
      .withMessage("invalid contest description"),
    body("contestId").exists().withMessage("invalid contest id"),
  ];
};
