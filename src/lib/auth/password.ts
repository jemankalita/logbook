import { createHash, timingSafeEqual } from "node:crypto";

/** The only thing standing between the internet and your data — keep it long. */
const MIN_PASSWORD_LENGTH = 12;

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Constant-time comparison against APP_PASSWORD (hashing equalises lengths). */
export function verifyPassword(candidate: string, expected = process.env.APP_PASSWORD): boolean {
  if (!expected || expected.length < MIN_PASSWORD_LENGTH) return false;
  return timingSafeEqual(digest(candidate), digest(expected));
}

export function isPasswordConfigured(expected = process.env.APP_PASSWORD): boolean {
  return Boolean(expected && expected.length >= MIN_PASSWORD_LENGTH);
}
