import crypto from "crypto";

export function generateOTPUtil(): string {
  let buffer: string | number | bigint = "";
  if (process.env.NODE_ENV === "development") {
    buffer = 1234;
    return buffer.toString();
  }
  buffer = crypto.randomInt(1000, 9999);
  return buffer.toString();
}

export function generateUUID(): string {
  return crypto.randomUUID();
}

