import { body, param } from "express-validator";

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

// Notification validators
export const sendNotificationValidator = () => {
  return [
    body("recipientType").isIn(['user_id', 'email', 'phone', 'all_users']).withMessage("recipientType must be one of: user_id, email, phone, all_users"),
    body("userId").optional().isUUID().withMessage("userId must be a valid UUID when provided"),
    body("recipientValue").optional().isString().withMessage("recipientValue must be a string when provided"),
    body("title").trim().notEmpty().withMessage("title is required"),
    body("body").trim().notEmpty().withMessage("body is required"),
    body("type").trim().notEmpty().withMessage("type is required"),
    body("data").optional().isObject().withMessage("data must be an object"),
    body("imageUrl").optional().isURL().withMessage("imageUrl must be a valid URL"),
    body("actionUrl").optional().isString().withMessage("actionUrl must be a string"),
    body("deviceToken").optional().isString().withMessage("deviceToken must be a string"),
  ];
};

export const sendBulkNotificationValidator = () => {
  return [
    body("notifications").isArray({ min: 1 }).withMessage("notifications must be a non-empty array"),
    body("notifications.*.userId").isUUID().withMessage("each notification must have a valid userId UUID"),
    body("notifications.*.title").trim().notEmpty().withMessage("each notification must have a title"),
    body("notifications.*.body").trim().notEmpty().withMessage("each notification must have a body"),
    body("notifications.*.type").trim().notEmpty().withMessage("each notification must have a type"),
  ];
};

export const notificationIdValidator = () => {
  return [
    param("id").isUUID().withMessage("notification id must be a valid UUID"),
  ];
};
