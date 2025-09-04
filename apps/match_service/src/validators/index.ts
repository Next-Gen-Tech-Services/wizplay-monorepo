import { query } from "express-validator";

export const listMatchesValidator = () => [
  query("status").optional().isString(),
  query("tournament_key").optional().isString(),
  query("team").optional().isString(),
  query("from").optional().isInt().toInt(),
  query("to").optional().isInt().toInt(),
  query("limit").optional().isInt({ min: 1, max: 200 }).toInt(),
  query("offset").optional().isInt({ min: 0 }).toInt(),
  query("sort").optional().isIn(["start_at", "-start_at"]),
];
