import { NextFunction, Request, Response } from "express";
import { BaseError } from "../errors/customError";
import { logger } from "../utils/globalLogger";

export class ErrorMiddleware {
  static handleError(
    err: BaseError,
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    const statusCode = err.statusCode || 500;
    const message =
      (err instanceof BaseError && err.message) || "Internal Server Error";

    logger.error(`${err.message} | Req-ID:${req.headers["x-request-id"]}`);
    res.status(statusCode).json({
      success: false,
      message,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  }
}
