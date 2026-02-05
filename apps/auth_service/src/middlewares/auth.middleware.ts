import { logger, UnAuthorizError, verifyToken } from "@repo/common";
import { NextFunction, Request, Response } from "express";
import { DB } from "../configs/database.config";
import ServerConfigs from "../configs/server.config";

declare global {
  namespace Express {
    interface Request {
      currentUserId?: string;
      currentAuthId?: string;
    }
  }
}

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.split(" ");

  if (!token || !token[1]?.length) {
    logger.error("[AUTH MIDDLEWARE]: No token provided");
    throw new UnAuthorizError("Unauthorized access");
  }

  try {
    logger.info(
      `[AUTH MIDDLEWARE]: Attempting to verify token: ${token[1].substring(0, 20)}...`,
    );

    const payload: any = verifyToken(token[1], ServerConfigs.TOKEN_SECRET);
    logger.info(`[AUTH MIDDLEWARE]: Token payload: ${JSON.stringify(payload)}`);

    // Extract session data from token
    const sessionId = payload?.session_id || payload?.data?.session_id;
    if (!sessionId) {
      logger.error("[AUTH MIDDLEWARE]: No session_id found in token");
      throw new UnAuthorizError("Invalid token format");
    }

    logger.info(`[AUTH MIDDLEWARE]: Session ID: ${sessionId}`);

    const sessionParts = sessionId.split(":");
    if (sessionParts.length !== 3) {
      logger.error(
        `[AUTH MIDDLEWARE]: Invalid session format. Parts: ${sessionParts.length}`,
      );
      throw new UnAuthorizError("Invalid session format");
    }

    const [authId, userId, emailOrPhone] = sessionParts;
    logger.info(
      `[AUTH MIDDLEWARE]: Extracted authId: ${authId}, userId: ${userId}, emailOrPhone: ${emailOrPhone}`,
    );

    // Verify user exists and is active
    // Check if emailOrPhone is email or phone number and search accordingly
    const whereCondition: any = {
      id: authId,
      userId: userId,
    };

    // Determine if emailOrPhone is email or phone number
    if (emailOrPhone.includes("@")) {
      whereCondition.email = emailOrPhone;
    } else {
      whereCondition.phoneNumber = emailOrPhone;
    }

    logger.info(
      `[AUTH MIDDLEWARE]: Search condition: ${JSON.stringify(whereCondition)}`,
    );

    const user = await DB.Auth.findOne({
      where: whereCondition,
    });

    if (!user) {
      logger.error(
        `[AUTH MIDDLEWARE]: User not found with authId: ${authId}, userId: ${userId}, email: ${emailOrPhone}`,
      );
      throw new UnAuthorizError("User not found");
    }

    // Check if user is inactive and provide specific message
    if (user.status === "inactive") {
      logger.error(
        `[AUTH MIDDLEWARE]: User account is inactive: ${userId}`,
      );
      throw new UnAuthorizError("Your account has been deactivated. Please contact admin for assistance.");
    }

    // Check for other non-active statuses
    if (user.status !== "active") {
      logger.error(
        `[AUTH MIDDLEWARE]: User account status is ${user.status}: ${userId}`,
      );
      throw new UnAuthorizError("Your account access has been restricted. Please contact admin for assistance.");
    }

    logger.info(
      `[AUTH MIDDLEWARE]: User authenticated successfully: ${userId}`,
    );

    // Set user info on request object
    req.currentUserId = userId;
    req.currentAuthId = authId;

    return next();
  } catch (error: any) {
    logger.error(`[AUTH MIDDLEWARE]: ${error.message || error}`);
    throw new UnAuthorizError("Invalid or expired token");
  }
};
