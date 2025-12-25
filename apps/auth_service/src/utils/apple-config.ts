import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import { UnAuthorizError } from "@repo/common";

const client = jwksClient({
  jwksUri: "https://appleid.apple.com/auth/keys",
  cache: true,
  cacheMaxAge: 86400000, // 24 hours
});

function getApplePublicKey(header: any, callback: any) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

export interface IAppleTokenPayload {
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  sub: string; // Unique user identifier
  email?: string;
  email_verified?: boolean | string;
  is_private_email?: boolean | string;
  real_user_status?: number;
}

export async function handleAppleAuth(
  identityToken: string
): Promise<IAppleTokenPayload> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      identityToken,
      getApplePublicKey,
      {
        algorithms: ["RS256"],
      },
      (err, decoded) => {
        if (err) {
          reject(new UnAuthorizError("Invalid Apple token"));
          return;
        }

        const payload = decoded as IAppleTokenPayload;

        // Verify issuer
        if (payload.iss !== "https://appleid.apple.com") {
          reject(new UnAuthorizError("Invalid Apple token issuer"));
          return;
        }

        resolve(payload);
      }
    );
  });
}
