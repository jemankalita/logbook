import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { settings } from "@/db/schema";

/** Small key/value store for app-wide settings. */
export async function getSetting<T>(key: string): Promise<T | null> {
  const db = await getDb();
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).limit(1);
  return row ? (row.value as T) : null;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
}

/** Sessions issued before this (unix seconds) are rejected — "sign out everywhere". */
export const SESSIONS_VALID_AFTER = "sessions_valid_after";
