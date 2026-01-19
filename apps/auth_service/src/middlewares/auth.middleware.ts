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
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.split(" ");

  if (!token || !token[1]?.length) {
    throw new UnAuthorizError("Unauthorized access");
  }

  try {
    const payload: any = verifyToken(token[1], ServerConfigs.TOKEN_SECRET);
    
    // Extract session data from token
    const sessionId = payload?.session_id || payload?.data?.session_id;
    if (!sessionId) {
      throw new UnAuthorizError("Invalid token format");
    }

    const sessionParts = sessionId.split(":");
    if (sessionParts.length !== 3) {
      throw new UnAuthorizError("Invalid session format");
    }

    const [authId, userId, email] = sessionParts;

    // Verify user exists and is active
    const user = await DB.Auth.findOne({
      where: {
        id: authId,
        userId: userId,
        email: email,
        status: "active",
      },
    });

    if (!user) {
      throw new UnAuthorizError("User not found or inactive");
    }

    // Set user info on request object
    req.currentUserId = userId;
    req.currentAuthId = authId;

    return next();
  } catch (error: any) {
    logger.error(`[AUTH MIDDLEWARE]: ${error.message || error}`);
    throw new UnAuthorizError("Invalid or expired token");
  }
};