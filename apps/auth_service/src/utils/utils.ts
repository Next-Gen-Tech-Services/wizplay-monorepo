import crypto from "crypto";

export function generateOTPUtil(): string {
  const buffer = crypto.randomInt(100000, 1000000);
  return buffer.toString();
}

export function generateUUID(): string {
  return crypto.randomUUID();
}
