import { jwtVerify, SignJWT } from "jose";

/** Edge-safe session helpers (used by middleware and server actions). */

/** `__Host-` pins the cookie to this exact host over HTTPS (no subdomain injection). */
export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-lb_session" : "lb_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const ISSUER = "logbook";
/** 32 random bytes in base64url = 43 chars. */
const MIN_SECRET_LENGTH = 43;

export class AuthConfigError extends Error {}

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new AuthConfigError(`SESSION_SECRET must be set and at least ${MIN_SECRET_LENGTH} characters long.`);
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setSubject("owner")
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export interface SessionInfo {
  /** issued-at, unix seconds */
  issuedAt: number;
}

/** Verified session details, or null when the token is missing, expired, or tampered with. */
export async function readSessionToken(token: string | undefined): Promise<SessionInfo | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"], issuer: ISSUER });
    if (payload.sub !== "owner" || typeof payload.iat !== "number") return null;
    return { issuedAt: payload.iat };
  } catch {
    // Expired, tampered, or misconfigured secret → treat as signed out.
    return null;
  }
}

export async function isValidSessionToken(token: string | undefined): Promise<boolean> {
  return (await readSessionToken(token)) !== null;
}

/** A session survives "sign out everywhere" only if it was issued at or after the cut-off. */
export function isIssuedAfterCutoff(issuedAt: number, validAfter: number | null): boolean {
  return validAfter === null || issuedAt >= validAfter;
}

const CONTROL_OR_BACKSLASH = /[\u0000-\u001f\u007f\\]/;
const PROBE_ORIGIN = "http://logbook.invalid";

/** Only allow same-site relative redirects after login (blocks open redirects). */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || CONTROL_OR_BACKSLASH.test(next)) return "/";
  let url: URL;
  try {
    url = new URL(next, PROBE_ORIGIN);
  } catch {
    return "/";
  }
  if (url.origin !== PROBE_ORIGIN || url.pathname.startsWith("/login")) return "/";
  return `${url.pathname}${url.search}`;
}
