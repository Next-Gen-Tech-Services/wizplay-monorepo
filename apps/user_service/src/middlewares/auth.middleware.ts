import { logger, UnAuthorizError } from "@repo/common";
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import ServerConfigs from "../configs/server.config";
import { IUserAtters } from "../dtos/user.dto";
import UserRepository from "../repositories/user.repository";

declare global {
  namespace Express {
    interface Request {
      currentUser?: IUserAtters;
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
    const payload: any = jwt.verify(sessionId[1], ServerConfigs.TOKEN_SECRET);

    const payloadKeys = payload?.data?.session_id.split(":");
    if (payloadKeys.length !== 3) {
      throw new UnAuthorizError();
    }
    const userRepository = new UserRepository();
    const user = await userRepository.getUserWithId(
      payloadKeys[1],
      payloadKeys[0]
    );
    if (!user) {
      throw new UnAuthorizError();
    }

    req.currentUser = user;
    return next();
  } catch (error) {
    logger.error(`[MIDDLEWARE]: ${error}`);
    throw new UnAuthorizError();
  }
};

export const requireAdminAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const bearerToken = req.headers.authorization;
  const tokenParts = bearerToken?.split(" ");

  if (!tokenParts || tokenParts.length !== 2) {
    throw new UnAuthorizError("Unauthorized access");
  }

  try {
    const payload: any = jwt.verify(tokenParts[1], ServerConfigs.TOKEN_SECRET);

    const { auth_id, email } = payload?.data || {};

    if (!auth_id || !email) throw new UnAuthorizError("Invalid admin token");

    const userRepository = new UserRepository();
    const adminUser = await userRepository.getUserById(auth_id);

    if (!adminUser) throw new UnAuthorizError("Admin not found");

    req.currentUser = { ...adminUser, type: "admin" };
    logger.info(`[ADMIN_AUTH] Authenticated admin: ${email}`);

    return next();
  } catch (error: any) {
    logger.error(`[ADMIN_AUTH ERROR]: ${error.message}`);
    throw new UnAuthorizError("Unauthorized admin access");
  }
};
