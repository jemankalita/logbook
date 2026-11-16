"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { journal } from "@/db/schema";
import { failure, type ActionResult } from "@/lib/actions";
import { requireSession } from "@/lib/auth/require-session";
import { diffDays, isDay, today } from "@/lib/dates";
import { docToText, parseDocJson } from "@/lib/rich-text";

/** No entries for future days (a typo in the URL shouldn't create one). */
function validDay(day: string): boolean {
  return typeof day === "string" && isDay(day) && diffDays(day, today()) <= 0;
}

export async function saveJournal(day: string, json: string): Promise<ActionResult> {
  await requireSession();
  if (!validDay(day)) return { ok: false, error: "You can only write for today or earlier." };
  const doc = parseDocJson(json);
  if (!doc) return { ok: false, error: "That content couldn't be saved." };
  const text = docToText(doc).slice(0, 200_000);
  try {
    const db = await getDb();
    await db
      .insert(journal)
      .values({ day, body: doc, bodyText: text })
      .onConflictDoUpdate({ target: journal.day, set: { body: doc, bodyText: text, updatedAt: new Date() } });
    revalidatePath("/journal");
    return { ok: true };
  } catch (err) {
    return failure("saveJournal", err);
  }
}

export async function setMood(day: string, mood: number): Promise<void> {
  await requireSession();
  if (!validDay(day) || !Number.isInteger(mood) || mood < 1 || mood > 5) return;
  const db = await getDb();
  const [existing] = await db.select({ mood: journal.mood }).from(journal).where(eq(journal.day, day)).limit(1);
  const next = existing?.mood === mood ? null : mood; // tap again to clear
  await db.insert(journal).values({ day, mood: next }).onConflictDoUpdate({ target: journal.day, set: { mood: next, updatedAt: new Date() } });
  revalidatePath("/journal");
  revalidatePath("/insights");
}
