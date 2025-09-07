import jwt from "jsonwebtoken";

export const generateToken = (data: any, secret: string) => {
  const token = jwt.sign(
    { exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, data: data },
    secret
  );

  return token;
};

export const verifyToken = (token: string, secret: string) => {
  const isValidToken = jwt.verify(token, secret);
  return isValidToken;
};
