"use server";

import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { attendance } from "@/db/schema";
import { requireSession, SESSION_CUTOFF_TAG } from "@/lib/auth/require-session";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { CALENDAR_TAG } from "@/lib/calendar/feeds";
import { today } from "@/lib/dates";
import { SESSIONS_VALID_AFTER, setSetting } from "@/lib/settings";

export async function checkIn(): Promise<void> {
  await requireSession();
  const db = await getDb();
  await db.insert(attendance).values({ day: today() }).onConflictDoNothing();
  revalidatePath("/");
}

export async function undoCheckIn(): Promise<void> {
  await requireSession();
  const db = await getDb();
  await db.delete(attendance).where(eq(attendance.day, today()));
  revalidatePath("/");
}

/** Fetch Google Calendar now instead of waiting for the hourly refresh. */
export async function refreshCalendar(): Promise<void> {
  await requireSession();
  revalidateTag(CALENDAR_TAG);
  revalidatePath("/calendar");
  revalidatePath("/");
}

export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

/** Revoke every session (all devices, including this one) by moving the cut-off to now. */
export async function signOutEverywhere(): Promise<void> {
  await requireSession();
  // Tokens carry whole-second issue times; +1 makes anything issued up to now invalid.
  await setSetting(SESSIONS_VALID_AFTER, Math.floor(Date.now() / 1000) + 1);
  revalidateTag(SESSION_CUTOFF_TAG);
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
