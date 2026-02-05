import { logger, UnAuthorizError } from "@repo/common";
import axios from "axios";
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import ServerConfigs from "../configs/server.config";
import { IUserAtters } from "../dtos/user.dto";

declare global {
  namespace Express {
    interface Request {
      currentUser?: IUserAtters;
      userId?: any;
    }
  }
}

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.log("[MIDDLEWARE] Access token: ", req.headers.authorization);
  const bearerToken = req.headers.authorization;
  const sessionId = bearerToken?.split(" ");

  if (!sessionId) {
    throw new UnAuthorizError("Unauthorized access");
  }

  try {
    console.log("[MIDDLEWARE] Session token: ", sessionId);
    const payload: any = jwt.verify(sessionId[1], ServerConfigs.TOKEN_SECRET);

    const payloadKeys = payload?.data?.session_id.split(":");
    logger.info(`Keys=====:${payloadKeys} `);
    if (payloadKeys.length !== 3) {
      throw new UnAuthorizError();
    }

    // Verify user status by calling auth service
    try {
      const authServiceUrl = process.env.AUTH_SERVICE_URL || "http://localhost:4001";
      const response = await axios.get(
        `${authServiceUrl}/api/v1/auth/verify-status/${payloadKeys[1]}`,
        {
          headers: {
            Authorization: req.headers.authorization,
          },
        }
      );
      
      if (response.data?.status === "inactive") {
        throw new UnAuthorizError("Your account has been deactivated. Please contact admin for assistance.");
      }
      
      if (response.data?.status !== "active") {
        throw new UnAuthorizError("Your account access has been restricted. Please contact admin for assistance.");
      }
    } catch (error: any) {
      if (error instanceof UnAuthorizError) {
        throw error;
      }
      logger.error(`[CONTEST SERVICE MIDDLEWARE]: Failed to verify user status: ${error.message}`);
    }

    // req.currentUser = user;
    req.userId = payloadKeys[1];
    return next();
  } catch (error) {
    logger.error(`[MIDDLEWARE]: ${error}`);
    throw new UnAuthorizError();
  }
};
