import crypto from "crypto";
import { logger } from "./globalLogger";

export const encryptPassword = (password: string): string => {
  const salt = crypto.randomBytes(16).toString("hex"); // Fixed: should be 'hex' not default

  const hashedPassword: string = crypto
    .pbkdf2Sync(password, salt, 1000, 64, "sha512")
    .toString("hex");

  // Store salt and hash together, separated by ':'
  const combined = `${salt}:${hashedPassword}`;

  logger.warn(`[Package|common] Hashed Password: ${hashedPassword}`);
  return combined;
};

export const validatePassword = (
  plainPassword: string,
  storedHash: string
): boolean => {
  try {
    // Extract salt and hash from stored string
    const [salt, hash] = storedHash.split(":");

    if (!salt || !hash) {
      logger.error("[Package|common] Invalid stored hash format");
      return false;
    }

    // Hash the plain password with the extracted salt
    const hashedAttempt: string = crypto
      .pbkdf2Sync(plainPassword, salt, 1000, 64, "sha512")
      .toString("hex");

    // Use timing-safe comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(hash, "hex"),
      Buffer.from(hashedAttempt, "hex")
    );

    logger.info(
      `[Package|common] Password validation: ${isValid ? "SUCCESS" : "FAILED"}`
    );
    return isValid;
  } catch (error) {
    logger.error(`[Package|common] Password validation error: ${error}`);
    return false;
  }
};
