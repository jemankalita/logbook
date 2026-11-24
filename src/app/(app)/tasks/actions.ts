"use server";

import { and, eq, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import { items, paths, taskCompletions, tasks } from "@/db/schema";
import { failure, firstIssue, formFields, optionalDay, optionalText, requiredText, uuid, type ActionResult } from "@/lib/actions";
import { requireSession } from "@/lib/auth/require-session";
import { appTimezone, dayInTimezone, today } from "@/lib/dates";
import { EFFORTS, PRIORITIES, rescheduleOverdueTasks, TASK_HORIZONS, TASK_STATUSES } from "@/lib/queries/tasks";
import { parseRecurrence } from "@/lib/tasks/recurrence";

function refresh() {
  revalidatePath("/tasks");
  revalidatePath("/");
  revalidatePath("/review");
  revalidatePath("/paths", "layout");
  revalidatePath("/insights");
}

const optionalId = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v && uuid.safeParse(v).success ? v : null));

const blankToNull = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .optional()
    .nullable()
    .transform((v) => ((values as readonly string[]).includes(v ?? "") ? (v as T[number]) : null));

const TaskInput = z.object({
  title: requiredText(300, "Give the task a name."),
  description: optionalText(5_000),
  horizon: z.enum(TASK_HORIZONS).default("daily"),
  status: z.enum(TASK_STATUSES).optional(),
  priority: blankToNull(PRIORITIES),
  effort: blankToNull(EFFORTS),
  area: optionalText(60),
  dueDate: optionalDay,
  recurrence: z
    .string()
    .optional()
    .nullable()
    .transform((v) => parseRecurrence(v)),
  pathId: optionalId,
  parentId: optionalId,
});

const FIELDS = ["title", "description", "horizon", "status", "priority", "effort", "area", "dueDate", "recurrence", "pathId", "parentId"] as const;

export async function createTask(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireSession();
  const parsed = TaskInput.safeParse(formFields(fd, FIELDS));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const data = parsed.data;
  // A daily task with no date means "today"; habits start today unless dated.
  const dueDate = data.dueDate ?? (data.horizon === "daily" || data.recurrence ? today() : null);
  try {
    const db = await getDb();
    const [row] = await db
      .insert(tasks)
      .values({ ...data, status: data.status ?? "not_started", dueDate })
      .returning({ id: tasks.id });
    refresh();
    return { ok: true, id: row.id, message: "Added." };
  } catch (err) {
    return failure("createTask", err);
  }
}

export async function updateTask(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireSession();
  const parsed = TaskInput.extend({ id: uuid }).safeParse(formFields(fd, ["id", ...FIELDS]));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { id, parentId, status, ...data } = parsed.data;
  if (parentId === id) return { ok: false, error: "A task can't be its own sub-task." };
  try {
    const db = await getDb();
    const [current] = await db.select({ status: tasks.status }).from(tasks).where(eq(tasks.id, id)).limit(1);
    if (!current) return { ok: false, error: "That task no longer exists." };
    const next = status ?? current.status;
    await db
      .update(tasks)
      .set({
        ...data,
        status: next,
        ...(next === "done" && current.status !== "done" ? { doneAt: new Date() } : {}),
        ...(next !== "done" ? { doneAt: null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, id));
    if (next === "done" && current.status !== "done" && !data.recurrence) {
      await db.insert(taskCompletions).values({ taskId: id, day: today() }).onConflictDoNothing();
    }
    refresh();
    return { ok: true, message: "Saved." };
  } catch (err) {
    return failure("updateTask", err);
  }
}

/**
 * Check / uncheck. One-off tasks flip done; habits record (or remove) today's completion.
 * Every completion is a row in task_completions, which feeds the "Tasks done" heatmap.
 */
export async function toggleTask(id: string): Promise<void> {
  await requireSession();
  if (!uuid.safeParse(id).success) return;
  const db = await getDb();
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  if (!task) return;
  const day = today();

  if (task.recurrence) {
    const removed = await db
      .delete(taskCompletions)
      .where(and(eq(taskCompletions.taskId, id), eq(taskCompletions.day, day)))
      .returning({ day: taskCompletions.day });
    if (removed.length === 0) await db.insert(taskCompletions).values({ taskId: id, day }).onConflictDoNothing();
  } else if (task.status === "done") {
    const doneDay = task.doneAt ? dayInTimezone(task.doneAt, appTimezone()) : day;
    await db.update(tasks).set({ status: "not_started", doneAt: null, updatedAt: new Date() }).where(eq(tasks.id, id));
    await db.delete(taskCompletions).where(and(eq(taskCompletions.taskId, id), eq(taskCompletions.day, doneDay)));
  } else {
    await db.update(tasks).set({ status: "done", doneAt: new Date(), updatedAt: new Date() }).where(eq(tasks.id, id));
    await db.insert(taskCompletions).values({ taskId: id, day }).onConflictDoNothing();
  }
  refresh();
}

const FieldInput = z.discriminatedUnion("field", [
  z.object({ id: uuid, field: z.literal("priority"), value: blankToNull(PRIORITIES) }),
  z.object({ id: uuid, field: z.literal("effort"), value: blankToNull(EFFORTS) }),
  z.object({ id: uuid, field: z.literal("dueDate"), value: optionalDay }),
]);

/** Inline table edits (priority, effort, due date) — one cell at a time, like a Notion database. */
export async function setTaskField(id: string, field: string, value: string): Promise<void> {
  await requireSession();
  const parsed = FieldInput.safeParse({ id, field, value });
  if (!parsed.success) return;
  const { field: key, value: next } = parsed.data;
  const db = await getDb();
  await db.update(tasks).set({ [key]: next, updatedAt: new Date() }).where(eq(tasks.id, parsed.data.id));
  refresh();
}

export async function setTaskStatus(id: string, status: string): Promise<void> {
  await requireSession();
  const parsed = z.object({ id: uuid, status: z.enum(TASK_STATUSES) }).safeParse({ id, status });
  if (!parsed.success) return;
  const db = await getDb();
  const [task] = await db.select({ status: tasks.status, recurrence: tasks.recurrence }).from(tasks).where(eq(tasks.id, id)).limit(1);
  if (!task || task.status === parsed.data.status) return;
  if (parsed.data.status === "done" || task.status === "done") {
    if (!task.recurrence) await toggleTask(id);
    if (parsed.data.status === "done") return;
  }
  await db.update(tasks).set({ status: parsed.data.status, updatedAt: new Date() }).where(eq(tasks.id, id));
  refresh();
}

/** Push an overdue or today's task to tomorrow. */
export async function snoozeTask(id: string): Promise<void> {
  await requireSession();
  if (!uuid.safeParse(id).success) return;
  const db = await getDb();
  const tomorrow = new Date(`${today()}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  await db
    .update(tasks)
    .set({ dueDate: tomorrow.toISOString().slice(0, 10), updatedAt: new Date() })
    .where(eq(tasks.id, id));
  refresh();
}

/** "Move all past-due to today" / "Clear their dates" on a task list. */
export async function fixOverdueTasks(horizon: string, fix: string): Promise<void> {
  await requireSession();
  const parsed = z.object({ horizon: z.enum(["daily", "upcoming"]), fix: z.enum(["today", "clear"]) }).safeParse({ horizon, fix });
  if (!parsed.success) return;
  await rescheduleOverdueTasks(parsed.data.horizon, today(), parsed.data.fix);
  refresh();
}

/** Attach an existing task to a path (from the path page). */
export async function linkTaskToPath(pathId: string, fd: FormData): Promise<void> {
  await requireSession();
  const parsed = z.object({ pathId: uuid, taskId: uuid }).safeParse({ pathId, taskId: fd.get("taskId") });
  if (!parsed.success) return;
  const db = await getDb();
  try {
    const [path] = await db.select({ id: paths.id }).from(paths).where(eq(paths.id, parsed.data.pathId)).limit(1);
    if (!path) return;
    // Only open, one-off, top-level tasks are offered in the picker; enforce the same here.
    await db
      .update(tasks)
      .set({ pathId: parsed.data.pathId, updatedAt: new Date() })
      .where(and(eq(tasks.id, parsed.data.taskId), isNull(tasks.parentId), isNull(tasks.recurrence), ne(tasks.status, "done")));
  } catch (err) {
    console.error("[tasks] linkTaskToPath failed", err);
    return;
  }
  refresh();
}

/** A title-only note (e.g. a Notion row with no content) is really a to-do: move it to Overall To-Do. */
export async function convertNoteToTask(noteId: string): Promise<void> {
  await requireSession();
  if (!uuid.safeParse(noteId).success) return;
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [note] = await tx
      .select({ title: items.title, bodyText: items.bodyText, starred: items.starred })
      .from(items)
      .where(and(eq(items.id, noteId), eq(items.kind, "note")))
      .limit(1);
    // Re-check inside the transaction: the note may have gained content since the page rendered.
    if (!note || note.starred || (note.bodyText ?? "").trim() !== "") return;
    await tx.insert(tasks).values({ title: note.title.slice(0, 300), horizon: "upcoming", status: "not_started" });
    await tx.delete(items).where(eq(items.id, noteId));
  });
  refresh();
  revalidatePath("/notes");
  revalidatePath("/library");
}

export async function deleteTask(id: string): Promise<void> {
  await requireSession();
  if (!uuid.safeParse(id).success) return;
  const db = await getDb();
  await db.delete(tasks).where(eq(tasks.id, id));
  refresh();
}
