import { logger, UnAuthorizError } from "@repo/common";
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import ServerConfigs from "../configs/server.config";
import { IUserAtters } from "../dtos/user.dto";

declare global {
  namespace Express {
    interface Request {
      currentUser?: IUserAtters;
      userId?: string;
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

    req.userId = payloadKeys[1];
    return next();
  } catch (error) {
    logger.error(`[MIDDLEWARE]: ${error}`);
    throw new UnAuthorizError();
  }
};
