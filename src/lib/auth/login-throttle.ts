import { eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { loginAttempts } from "@/db/schema";
import { GLOBAL_RULE, isOverLimit, PER_IP_RULE, type ThrottleRule } from "./rate-limit";

const GLOBAL_KEY = "global";
const ipKey = (ip: string) => `ip:${ip}`;

export async function isLoginBlocked(ip: string, now = new Date()): Promise<boolean> {
  const db = await getDb();
  const rows = await db.select().from(loginAttempts).where(inArray(loginAttempts.key, [ipKey(ip), GLOBAL_KEY]));
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return isOverLimit(byKey.get(ipKey(ip)), now, PER_IP_RULE) || isOverLimit(byKey.get(GLOBAL_KEY), now, GLOBAL_RULE);
}

/** Atomic upsert: increments inside the window, or starts a fresh window. */
async function bump(key: string, rule: ThrottleRule, now: Date): Promise<void> {
  const db = await getDb();
  const nowIso = now.toISOString();
  const cutoffIso = new Date(now.getTime() - rule.windowMs).toISOString();
  const expired = sql`${loginAttempts.windowStart} <= ${cutoffIso}::timestamptz`;

  await db
    .insert(loginAttempts)
    .values({ key, count: 1, windowStart: now })
    .onConflictDoUpdate({
      target: loginAttempts.key,
      set: {
        count: sql`case when ${expired} then 1 else ${loginAttempts.count} + 1 end`,
        windowStart: sql`case when ${expired} then ${nowIso}::timestamptz else ${loginAttempts.windowStart} end`,
      },
    });
}

export async function recordLoginFailure(ip: string, now = new Date()): Promise<void> {
  await Promise.all([bump(ipKey(ip), PER_IP_RULE, now), bump(GLOBAL_KEY, GLOBAL_RULE, now)]);
}

/** A correct password clears that IP's counter (the global window just expires). */
export async function clearLoginFailures(ip: string): Promise<void> {
  const db = await getDb();
  await db.delete(loginAttempts).where(eq(loginAttempts.key, ipKey(ip)));
}
