"use server";

import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { attendance } from "@/db/schema";
import { requireSession } from "@/lib/auth/require-session";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { CALENDAR_TAG } from "@/lib/calendar/feeds";
import { today } from "@/lib/dates";

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
