"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, formFields, uuid, type ActionResult } from "@/lib/actions";
import { requireSession } from "@/lib/auth/require-session";
import { isDay } from "@/lib/dates";
import { moveTasksToNextWeek } from "@/lib/queries/review";
import { reviewKey, toReflection, weekStartOf } from "@/lib/review";
import { getSetting, setSetting } from "@/lib/settings";

const MAX_TEXT = 5_000;

/** A week is identified by its Monday; anything else is rejected rather than silently snapped. */
const weekStart = z.string().refine((v) => isDay(v) && weekStartOf(v) === v, "Unknown week.");

const ReflectionInput = z.object({
  wins: z.string().max(MAX_TEXT).default(""),
  blockers: z.string().max(MAX_TEXT).default(""),
  focus: z.string().max(MAX_TEXT).default(""),
  intent: z.enum(["save", "complete", "reopen"]).default("save"),
});

function refresh() {
  revalidatePath("/review");
  revalidatePath("/");
  revalidatePath("/tasks");
}

/** Save the reflection; "complete" also marks the week reviewed (which feeds the streak). */
export async function saveReflection(start: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireSession();
  if (!weekStart.safeParse(start).success) return { ok: false, error: "Unknown week." };
  const parsed = ReflectionInput.safeParse(formFields(fd, ["wins", "blockers", "focus", "intent"]));
  if (!parsed.success) return { ok: false, error: `Keep each answer under ${MAX_TEXT.toLocaleString()} characters.` };
  const { intent, ...text } = parsed.data;
  try {
    const previous = toReflection(await getSetting(reviewKey(start)));
    const reviewedAt = intent === "complete" ? (previous.reviewedAt ?? new Date().toISOString()) : intent === "reopen" ? null : previous.reviewedAt;
    await setSetting(reviewKey(start), { wins: text.wins.trim(), blockers: text.blockers.trim(), focus: text.focus.trim(), reviewedAt });
    refresh();
    return { ok: true, message: intent === "complete" ? "Week reviewed. Nice work." : intent === "reopen" ? "Reopened." : "Saved." };
  } catch (err) {
    return failure("saveReflection", err);
  }
}

/** Push one carry-over task to next Monday. */
export async function carryTaskToNextWeek(start: string, taskId: string): Promise<void> {
  await requireSession();
  if (!weekStart.safeParse(start).success || !uuid.safeParse(taskId).success) return;
  await moveTasksToNextWeek(start, taskId);
  refresh();
}

/** Push every carry-over task of the week to next Monday. */
export async function carryAllToNextWeek(start: string): Promise<void> {
  await requireSession();
  if (!weekStart.safeParse(start).success) return;
  await moveTasksToNextWeek(start);
  refresh();
}
