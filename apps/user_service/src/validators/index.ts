import { body } from "express-validator";

export const updateNameValidator = () => {
  return [
    body("name").exists().trim().toLowerCase().withMessage("name is required"),
  ];
};
