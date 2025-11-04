import { logger, STATUS_CODE } from "@repo/common";
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import ServerConfigs from "../configs/server.config";

declare global {
  namespace Express {
    interface Request {
      currentUser?: any;
      userId?: string;
    }
  }
}

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(STATUS_CODE.UN_AUTHORIZED).json({
        success: false,
        message: "No token provided",
        timestamp: new Date().toISOString(),
      });
    }

    const payload: any = jwt.verify(token, ServerConfigs.TOKEN_SECRET);
    
    // Support different token formats
    if (payload?.data?.session_id) {
      const payloadKeys = payload.data.session_id.split(":");
      req.userId = payloadKeys[1];
    } else if (payload?.userId) {
      req.userId = payload.userId;
    } else {
      return res.status(STATUS_CODE.UN_AUTHORIZED).json({
        success: false,
        message: "Invalid token format",
        timestamp: new Date().toISOString(),
      });
    }

    req.currentUser = payload;
    next();
  } catch (error) {
    return res.status(STATUS_CODE.UN_AUTHORIZED).json({
      success: false,
      message: "Invalid or expired token",
      timestamp: new Date().toISOString(),
    });
  }
};
