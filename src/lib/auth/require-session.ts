import { cookies } from "next/headers";
import { isValidSessionToken, SESSION_COOKIE } from "./session";

/**
 * Defence in depth for server actions: middleware already guards every route,
 * but actions re-check the session before touching data.
 */
export async function requireSession(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await isValidSessionToken(token))) {
    throw new Error("Not signed in.");
  }
}
