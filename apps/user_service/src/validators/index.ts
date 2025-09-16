import { body } from "express-validator";

export const updateNameValidator = () => {
  return [
    body("name").optional().trim().toLowerCase(),
    body("email").optional().trim().toLowerCase(),
  ];
};
