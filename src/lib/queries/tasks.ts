import { and, asc, eq, gt, gte, inArray, isNotNull, isNull, lte, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { paths, taskCompletions, tasks } from "@/db/schema";
import { addDays, appTimezone, dayInTimezone, type Day } from "@/lib/dates";
import { habitStreak, occursOn } from "@/lib/tasks/recurrence";

export type Task = typeof tasks.$inferSelect;

export interface Habit extends Task {
  doneToday: boolean;
  streak: number;
  /** last 7 days, oldest first: null = not scheduled */
  week: (boolean | null)[];
}

export const TASK_HORIZONS = ["daily", "upcoming", "roadmap"] as const;
export const TASK_STATUSES = ["not_started", "in_progress", "done"] as const;
export const PRIORITIES = ["high", "medium", "low"] as const;
export const EFFORTS = ["small", "medium", "large"] as const;
export type Horizon = (typeof TASK_HORIZONS)[number];

const HABIT_HISTORY_DAYS = 400;

const priorityOrder = sql`case ${tasks.priority} when 'high' then 0 when 'medium' then 1 when 'low' then 2 else 3 end`;

export function startDay(task: Pick<Task, "dueDate" | "createdAt">): Day {
  return task.dueDate ?? dayInTimezone(task.createdAt, appTimezone());
}

export async function getHabits(today: Day): Promise<{ scheduled: Habit[]; other: Habit[] }> {
  const db = await getDb();
  const rows = await db.select().from(tasks).where(isNotNull(tasks.recurrence)).orderBy(asc(tasks.position), asc(tasks.createdAt));
  if (rows.length === 0) return { scheduled: [], other: [] };

  const completions = await db
    .select({ taskId: taskCompletions.taskId, day: taskCompletions.day })
    .from(taskCompletions)
    .where(and(inArray(taskCompletions.taskId, rows.map((r) => r.id)), gte(taskCompletions.day, addDays(today, -HABIT_HISTORY_DAYS))));
  const doneBy = new Map<string, Set<Day>>();
  for (const c of completions) {
    const set = doneBy.get(c.taskId) ?? new Set<Day>();
    set.add(c.day);
    doneBy.set(c.taskId, set);
  }

  const habits = rows.map<Habit>((t) => {
    const done = doneBy.get(t.id) ?? new Set<Day>();
    const start = startDay(t);
    return {
      ...t,
      doneToday: done.has(today),
      streak: habitStreak(t.recurrence, start, done, today),
      week: Array.from({ length: 7 }, (_, i) => {
        const day = addDays(today, i - 6);
        return occursOn(t.recurrence, start, day) ? done.has(day) : null;
      }),
    };
  });
  return {
    scheduled: habits.filter((h) => occursOn(h.recurrence, startDay(h), today)),
    other: habits.filter((h) => !occursOn(h.recurrence, startDay(h), today)),
  };
}

/** Today: open one-off tasks due today or earlier (or undated daily ones), plus what you finished today. */
export async function getTodayTasks(today: Day): Promise<Task[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(tasks)
    .where(
      and(
        isNull(tasks.recurrence),
        isNull(tasks.parentId),
        ne(tasks.horizon, "roadmap"),
        or(
          and(ne(tasks.status, "done"), or(lte(tasks.dueDate, today), and(isNull(tasks.dueDate), eq(tasks.horizon, "daily")))),
          and(eq(tasks.status, "done"), gte(tasks.doneAt, new Date(Date.now() - 36 * 3600_000))),
        ),
      ),
    )
    .orderBy(asc(tasks.status), priorityOrder, asc(tasks.dueDate), asc(tasks.createdAt));
  // "Done today" is decided in the owner's timezone, not the server's.
  const tz = appTimezone();
  return rows.filter((t) => t.status !== "done" || (t.doneAt && dayInTimezone(t.doneAt, tz) === today));
}

/**
 * One Notion-style list: every one-off top-level task of a horizon ("daily" = Daily Tasks,
 * "upcoming" = Overall To-Do), open ones first, then by priority and due date.
 */
export async function getTaskList(horizon: "daily" | "upcoming"): Promise<Task[]> {
  const db = await getDb();
  return db
    .select()
    .from(tasks)
    .where(and(isNull(tasks.recurrence), isNull(tasks.parentId), eq(tasks.horizon, horizon)))
    .orderBy(sql`case ${tasks.status} when 'in_progress' then 0 when 'not_started' then 1 else 2 end`, priorityOrder, sql`${tasks.dueDate} asc nulls last`, asc(tasks.createdAt));
}

export async function getUpcomingTasks(today: Day): Promise<Task[]> {
  const db = await getDb();
  return db
    .select()
    .from(tasks)
    .where(
      and(
        isNull(tasks.recurrence),
        isNull(tasks.parentId),
        ne(tasks.status, "done"),
        ne(tasks.horizon, "roadmap"),
        or(gt(tasks.dueDate, today), and(isNull(tasks.dueDate), eq(tasks.horizon, "upcoming"))),
      ),
    )
    .orderBy(sql`${tasks.dueDate} asc nulls last`, priorityOrder, asc(tasks.createdAt));
}

export interface RoadmapItem extends Task {
  children: Task[];
  pathName: string | null;
}

export async function getRoadmap(): Promise<RoadmapItem[]> {
  const db = await getDb();
  const roots = await db
    .select({ task: tasks, pathName: paths.name })
    .from(tasks)
    .leftJoin(paths, eq(paths.id, tasks.pathId))
    .where(and(eq(tasks.horizon, "roadmap"), isNull(tasks.parentId)))
    .orderBy(asc(tasks.area), asc(tasks.position), asc(tasks.createdAt));
  if (roots.length === 0) return [];
  const children = await db
    .select()
    .from(tasks)
    .where(inArray(tasks.parentId, roots.map((r) => r.task.id)))
    .orderBy(asc(tasks.position), asc(tasks.createdAt));
  return roots.map((r) => ({ ...r.task, pathName: r.pathName, children: children.filter((c) => c.parentId === r.task.id) }));
}

export async function getPathOptions(): Promise<{ id: string; name: string }[]> {
  const db = await getDb();
  return db.select({ id: paths.id, name: paths.name }).from(paths).orderBy(asc(paths.position), asc(paths.name));
}

export async function getAreas(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.selectDistinct({ area: tasks.area }).from(tasks).where(isNotNull(tasks.area)).orderBy(asc(tasks.area));
  return rows.map((r) => r.area as string);
}

export type OverdueFix = "today" | "clear";

/**
 * Bulk-fix a list's past-due tasks: move them all to today, or drop their dates.
 * Only open, one-off tasks are touched — habits and finished tasks keep their dates.
 */
export async function rescheduleOverdueTasks(horizon: "daily" | "upcoming", today: Day, fix: OverdueFix): Promise<number> {
  const db = await getDb();
  const moved = await db
    .update(tasks)
    .set({ dueDate: fix === "today" ? today : null, updatedAt: new Date() })
    .where(and(eq(tasks.horizon, horizon), isNull(tasks.recurrence), ne(tasks.status, "done"), sql`${tasks.dueDate} < ${today}`))
    .returning({ id: tasks.id });
  return moved.length;
}

/** Open tasks not yet attached to any path — candidates for "Add an existing task" on a path. */
export async function getUnlinkedOpenTasks(limit = 200): Promise<Pick<Task, "id" | "title" | "horizon">[]> {
  const db = await getDb();
  return db
    .select({ id: tasks.id, title: tasks.title, horizon: tasks.horizon })
    .from(tasks)
    .where(and(isNull(tasks.pathId), isNull(tasks.recurrence), isNull(tasks.parentId), ne(tasks.status, "done")))
    .orderBy(asc(tasks.title))
    .limit(limit);
}

export async function getTasksForPath(pathId: string): Promise<Task[]> {
  const db = await getDb();
  return db.select().from(tasks).where(eq(tasks.pathId, pathId)).orderBy(asc(tasks.status), asc(tasks.dueDate), asc(tasks.createdAt));
}
