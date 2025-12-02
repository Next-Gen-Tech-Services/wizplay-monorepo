import { query } from "express-validator";

export const listMatchesValidator = () => {
  return [
    // Strings
    query("sport").optional().isString().trim().toLowerCase(),
    query("format").optional().isString().trim().toLowerCase(),
    query("gender").optional().isString().trim().toLowerCase(),
    query("status").optional().isString().trim().toLowerCase(),
    query("tournamentKey").optional().isString().trim().toLowerCase(),
    query("winner").optional().isString().trim().toLowerCase(),
    query("name").optional().isString().trim(),
    query("shortName").optional().isString().trim(),
    query("metricGroup").optional().isString().trim(),
    query("showOnFrontend").optional().isString().trim(),
    query("teamName").optional().isString().trim(),
    query("search").optional().isString().trim(),

    // Dates (timestamps passed as strings → cast later)
    query("startedAfter")
      .optional()
      .isISO8601()
      .withMessage("startedAfter must be a valid ISO date"),
    query("startedBefore")
      .optional()
      .isISO8601()
      .withMessage("startedBefore must be a valid ISO date"),
    query("date")
      .optional()
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage("date must be in YYYY-MM-DD format"),

    // Pagination
    query("limit")
      .optional()
      .isInt({ min: 1, max: 10000 })
      .toInt()
      .withMessage("limit must be between 1 and 10000"),
    query("offset")
      .optional()
      .isInt({ min: 0 })
      .toInt()
      .withMessage("offset must be >= 0"),
  ];
};
