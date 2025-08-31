import { NextFunction, Request, Response } from "express";
import { BaseError, RequestValidationError } from "../errors/customError";
import { logger } from "../utils/globalLogger";

export class ErrorMiddleware {
  static handleError(
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    let statusCode = 500;
    let message = "Internal Server Error";
    let errors: any = null;

    // Handle custom errors
    if (err instanceof BaseError) {
      statusCode = err.statusCode;
      message = err.message;
    }

    // Handle request validation error specifically
    if (err instanceof RequestValidationError) {
      statusCode = err.statusCode;
      message = "Validation Failed";
      errors = err.serializeErrors();
    }

    logger.error(
      `${err.message} | Req-ID:${req.headers["x-request-id"]} | URL:${req.url}`,
    );

    res.status(statusCode).json({
      success: false,
      message,
      ...(errors && { errors }),
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  }
}
