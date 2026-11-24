import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSetting, SESSIONS_VALID_AFTER } from "@/lib/settings";
import { isIssuedAfterCutoff, readSessionToken, SESSION_COOKIE } from "./session";

/**
 * Middleware checks the cookie's signature on every request (edge, no database).
 * These Node-side checks also honour "sign out everywhere", which needs the database.
 */
async function hasLiveSession(): Promise<boolean> {
  const session = await readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return false;
  const validAfter = await getSessionCutoff();
  return isIssuedAfterCutoff(session.issuedAt, typeof validAfter === "number" ? validAfter : null);
}

export const SESSION_CUTOFF_TAG = "session-cutoff";

/**
 * Every page and action checks this, and it only changes on "sign out everywhere"
 * (which busts the tag), so keep it out of the database on the hot path.
 */
const getSessionCutoff = unstable_cache(() => getSetting<number>(SESSIONS_VALID_AFTER), ["session-cutoff-v1"], {
  tags: [SESSION_CUTOFF_TAG],
});

/** For server actions and route handlers: throws when signed out. */
export async function requireSession(): Promise<void> {
  if (!(await hasLiveSession())) throw new Error("Not signed in.");
}

/** For pages/layouts: a revoked session is sent through /logout, which clears the cookie. */
export async function requirePageSession(): Promise<void> {
  if (!(await hasLiveSession())) redirect("/logout");
}
