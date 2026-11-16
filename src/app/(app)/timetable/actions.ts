"use server";

import { and, eq, gte, lt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import { timeBlocks } from "@/db/schema";
import { failure, firstIssue, formFields, optionalText, requiredText, uuid, type ActionResult } from "@/lib/actions";
import { requireSession } from "@/lib/auth/require-session";
import { addDays, appTimezone, isDay } from "@/lib/dates";
import { isTime, startOfWeek, zonedToUtc } from "@/lib/time";

const MAX_BLOCK_MINUTES = 24 * 60;

function refresh() {
  revalidatePath("/timetable");
  revalidatePath("/insights");
  revalidatePath("/");
}

const BlockInput = z
  .object({
    title: requiredText(200, "Name the block."),
    area: optionalText(60),
    notes: optionalText(2_000),
    day: z.string().refine(isDay, "Pick a day."),
    start: z.string().refine(isTime, "Pick a start time."),
    end: z.string().refine(isTime, "Pick an end time."),
  })
  .refine((v) => v.end > v.start, { message: "End must be after start.", path: ["end"] });

function toRange(day: string, start: string, end: string) {
  const tz = appTimezone();
  const startsAt = zonedToUtc(day, start, tz);
  const endsAt = zonedToUtc(day, end, tz);
  return { startsAt, endsAt };
}

export async function saveBlock(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireSession();
  const raw = formFields(fd, ["id", "title", "area", "notes", "day", "start", "end"]);
  const parsed = BlockInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { day, start, end, ...fields } = parsed.data;
  const range = toRange(day, start, end);
  if ((range.endsAt.getTime() - range.startsAt.getTime()) / 60_000 > MAX_BLOCK_MINUTES) return { ok: false, error: "Blocks can't be longer than a day." };
  try {
    const db = await getDb();
    if (raw.id && uuid.safeParse(raw.id).success) {
      await db.update(timeBlocks).set({ ...fields, ...range }).where(eq(timeBlocks.id, raw.id));
    } else {
      await db.insert(timeBlocks).values({ ...fields, ...range });
    }
    refresh();
    return { ok: true, message: "Saved." };
  } catch (err) {
    return failure("saveBlock", err);
  }
}

export async function toggleBlock(id: string): Promise<void> {
  await requireSession();
  if (!uuid.safeParse(id).success) return;
  const db = await getDb();
  const [row] = await db.select({ done: timeBlocks.done }).from(timeBlocks).where(eq(timeBlocks.id, id)).limit(1);
  if (!row) return;
  await db.update(timeBlocks).set({ done: !row.done }).where(eq(timeBlocks.id, id));
  refresh();
}

export async function deleteBlock(id: string): Promise<void> {
  await requireSession();
  if (!uuid.safeParse(id).success) return;
  const db = await getDb();
  await db.delete(timeBlocks).where(eq(timeBlocks.id, id));
  refresh();
}

/** Copy every block from the week before `weekStart` into that week (for repeating class schedules). */
export async function copyPreviousWeek(weekStart: string): Promise<void> {
  await requireSession();
  if (!isDay(weekStart)) return;
  const monday = startOfWeek(weekStart);
  const tz = appTimezone();
  const prevStart = zonedToUtc(addDays(monday, -7), "00:00", tz);
  const thisStart = zonedToUtc(monday, "00:00", tz);
  const thisEnd = zonedToUtc(addDays(monday, 7), "00:00", tz);
  const db = await getDb();
  const [source, existing] = await Promise.all([
    db.select().from(timeBlocks).where(and(gte(timeBlocks.startsAt, prevStart), lt(timeBlocks.startsAt, thisStart))),
    db.select({ startsAt: timeBlocks.startsAt, title: timeBlocks.title }).from(timeBlocks).where(and(gte(timeBlocks.startsAt, thisStart), lt(timeBlocks.startsAt, thisEnd))),
  ]);
  const WEEK_MS = 7 * 86_400_000;
  const seen = new Set(existing.map((e) => `${e.startsAt.getTime()}|${e.title}`));
  const copies = source
    .map((b) => ({ title: b.title, area: b.area, notes: b.notes, startsAt: new Date(b.startsAt.getTime() + WEEK_MS), endsAt: new Date(b.endsAt.getTime() + WEEK_MS) }))
    .filter((b) => !seen.has(`${b.startsAt.getTime()}|${b.title}`));
  if (copies.length) await db.insert(timeBlocks).values(copies);
  refresh();
}
