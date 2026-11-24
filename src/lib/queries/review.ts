import { and, asc, eq, gte, isNull, like, lte, ne } from "drizzle-orm";
import { getDb } from "@/db/client";
import { attendance, items, journal, settings, taskCompletions, tasks, timeBlocks } from "@/db/schema";
import { addDays, appTimezone, dayInTimezone, type Day } from "@/lib/dates";
import { reviewKey, reviewStreak, toReflection, weekRange, weekStartOf, type Reflection } from "@/lib/review";
import type { Task } from "./tasks";

export interface DoneItem {
  id: string;
  title: string;
  day: Day;
}

export interface HabitWeek {
  id: string;
  title: string;
  /** days ticked this week */
  done: number;
}

export interface WeekReview {
  start: Day;
  /** one-off tasks finished this week, oldest first */
  done: DoneItem[];
  habits: HabitWeek[];
  /** open tasks due this week or earlier — what carries over */
  carryOver: Task[];
  /** open tasks already due next week */
  nextWeek: Task[];
  stats: {
    tasksDone: number;
    habitTicks: number;
    daysPresent: number;
    journalDays: number;
    /** average mood 1–5 over journal days that had one; null if none */
    mood: number | null;
    linksSaved: number;
    focusedHours: number;
  };
  reflection: Reflection;
  /** consecutive reviewed weeks (see reviewStreak) */
  streak: number;
}

const openOneOff = and(isNull(tasks.recurrence), isNull(tasks.parentId), ne(tasks.status, "done"), ne(tasks.horizon, "roadmap"));

/** Timestamps → owner's days; fetch with a day of slack either side, then filter exactly. */
function inWeek(at: Date, start: Day, end: Day, tz: string): boolean {
  const day = dayInTimezone(at, tz);
  return day >= start && day <= end;
}

export async function getReviewedWeeks(): Promise<Set<Day>> {
  const db = await getDb();
  const rows = await db.select({ key: settings.key, value: settings.value }).from(settings).where(like(settings.key, "review:%"));
  return new Set(rows.filter((r) => toReflection(r.value).reviewedAt).map((r) => r.key.slice("review:".length)));
}

export async function getWeekReview(start: Day, today: Day): Promise<WeekReview> {
  const db = await getDb();
  const tz = appTimezone();
  const { end, next, nextEnd } = weekRange(start);
  const slackFrom = new Date(`${addDays(start, -1)}T00:00:00Z`);
  const slackTo = new Date(`${addDays(end, 2)}T00:00:00Z`);

  const [completions, carryOver, nextWeek, present, journalRows, links, blocks, reflectionRow, reviewed] = await Promise.all([
    db
      .select({ id: tasks.id, title: tasks.title, day: taskCompletions.day, recurrence: tasks.recurrence })
      .from(taskCompletions)
      .innerJoin(tasks, eq(tasks.id, taskCompletions.taskId))
      .where(and(gte(taskCompletions.day, start), lte(taskCompletions.day, end)))
      .orderBy(asc(taskCompletions.day), asc(tasks.title)),
    db
      .select()
      .from(tasks)
      .where(and(openOneOff, lte(tasks.dueDate, end)))
      .orderBy(asc(tasks.dueDate), asc(tasks.title)),
    db
      .select()
      .from(tasks)
      .where(and(openOneOff, gte(tasks.dueDate, next), lte(tasks.dueDate, nextEnd)))
      .orderBy(asc(tasks.dueDate), asc(tasks.title)),
    db.select({ day: attendance.day }).from(attendance).where(and(gte(attendance.day, start), lte(attendance.day, end))),
    db.select({ day: journal.day, mood: journal.mood }).from(journal).where(and(gte(journal.day, start), lte(journal.day, end))),
    db
      .select({ createdAt: items.createdAt })
      .from(items)
      .where(and(eq(items.kind, "link"), gte(items.createdAt, slackFrom), lte(items.createdAt, slackTo))),
    db
      .select({ startsAt: timeBlocks.startsAt, endsAt: timeBlocks.endsAt })
      .from(timeBlocks)
      .where(and(eq(timeBlocks.done, true), gte(timeBlocks.startsAt, slackFrom), lte(timeBlocks.startsAt, slackTo))),
    db.select({ value: settings.value }).from(settings).where(eq(settings.key, reviewKey(start))).limit(1),
    getReviewedWeeks(),
  ]);

  const done = completions.filter((c) => !c.recurrence).map(({ id, title, day }) => ({ id, title, day }));
  const habitMap = new Map<string, HabitWeek>();
  for (const c of completions.filter((c) => c.recurrence)) {
    const h = habitMap.get(c.id) ?? { id: c.id, title: c.title, done: 0 };
    habitMap.set(c.id, { ...h, done: h.done + 1 });
  }
  const habits = [...habitMap.values()].sort((a, b) => b.done - a.done || a.title.localeCompare(b.title));
  const moods = journalRows.map((j) => j.mood).filter((m): m is number => typeof m === "number");
  const minutes = blocks
    .filter((b) => inWeek(b.startsAt, start, end, tz))
    .reduce((sum, b) => sum + Math.max(0, (b.endsAt.getTime() - b.startsAt.getTime()) / 60_000), 0);

  return {
    start,
    done,
    habits,
    carryOver,
    nextWeek,
    stats: {
      tasksDone: done.length,
      habitTicks: completions.length - done.length,
      daysPresent: present.length,
      journalDays: journalRows.length,
      mood: moods.length ? Math.round((moods.reduce((a, b) => a + b, 0) / moods.length) * 10) / 10 : null,
      linksSaved: links.filter((l) => inWeek(l.createdAt, start, end, tz)).length,
      focusedHours: Math.round((minutes / 60) * 10) / 10,
    },
    reflection: toReflection(reflectionRow[0]?.value),
    streak: reviewStreak(reviewed, weekStartOf(today)),
  };
}

/** Move open tasks to the Monday of next week (one task, or every carry-over of a week). */
export async function moveTasksToNextWeek(start: Day, taskId?: string): Promise<number> {
  const db = await getDb();
  const { end, next } = weekRange(start);
  const moved = await db
    .update(tasks)
    .set({ dueDate: next, updatedAt: new Date() })
    .where(and(openOneOff, taskId ? eq(tasks.id, taskId) : lte(tasks.dueDate, end)))
    .returning({ id: tasks.id });
  return moved.length;
}
