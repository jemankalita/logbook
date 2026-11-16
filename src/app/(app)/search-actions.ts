"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { items, tasks } from "@/db/schema";
import { failure, type ActionResult } from "@/lib/actions";
import { requireSession } from "@/lib/auth/require-session";
import { today } from "@/lib/dates";
import { searchEverything as runSearch, type SearchHit } from "@/lib/queries/search";
import { textToDoc } from "@/lib/rich-text";

const MAX_QUICK_TEXT = 5_000;

export async function searchEverything(q: string): Promise<SearchHit[]> {
  await requireSession();
  if (typeof q !== "string") return [];
  try {
    return await runSearch(q);
  } catch (err) {
    console.error("[search]", err);
    return [];
  }
}

function firstLine(text: string): string {
  return text.split(/\r?\n/)[0].trim().slice(0, 300);
}

/** ⌘K / share sheet: a quick note from plain text. */
export async function quickNote(text: string): Promise<ActionResult> {
  await requireSession();
  const body = typeof text === "string" ? text.trim().slice(0, MAX_QUICK_TEXT) : "";
  if (!body) return { ok: false, error: "Type something first." };
  try {
    const db = await getDb();
    const [row] = await db
      .insert(items)
      .values({ kind: "note", type: "note", title: firstLine(body) || "Untitled", body: textToDoc(body), bodyText: body, source: "manual" })
      .returning({ id: items.id });
    revalidatePath("/notes", "layout");
    return { ok: true, id: row.id, message: "Note saved." };
  } catch (err) {
    return failure("quickNote", err);
  }
}

/** ⌘K: a task for today. */
export async function quickTask(text: string): Promise<ActionResult> {
  await requireSession();
  const title = typeof text === "string" ? firstLine(text) : "";
  if (!title) return { ok: false, error: "Type a task first." };
  try {
    const db = await getDb();
    const [row] = await db.insert(tasks).values({ title, horizon: "daily", dueDate: today() }).returning({ id: tasks.id });
    revalidatePath("/tasks");
    revalidatePath("/");
    return { ok: true, id: row.id, message: "Task added for today." };
  } catch (err) {
    return failure("quickTask", err);
  }
}
