import { UnAuthorizError, verifyToken } from "@repo/common";
import { NextFunction, Request, Response } from "express";
import { DB } from "../configs/database.config";
import ServerConfigs from "../configs/server.config";

export const isAdminMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.split(" ");

  if (!token || !token[1]?.length) {
    throw new UnAuthorizError();
  }

  const decrypyToken: any = verifyToken(token[1], ServerConfigs.TOKEN_SECRET);

  if (!decrypyToken.auth_id || !decrypyToken.email) {
    throw new UnAuthorizError();
  }

  const user = await DB.Auth.findOne({
    where: {
      id: decrypyToken.auth_id,
      email: decrypyToken.email,
    },
  });

  if (!user) {
    throw new UnAuthorizError();
  }

  next();
};
