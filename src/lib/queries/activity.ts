import { count, eq, gte } from "drizzle-orm";
import { getDb } from "@/db/client";
import { attendance, taskCompletions } from "@/db/schema";
import type { Day } from "@/lib/dates";
import type { ActivityInput } from "@/lib/heatmap";

export interface TodayAttendance {
  checkedInAt: Date;
}

/**
 * Attendance days and per-day completed-task counts, since `from` when given.
 * Without `from` it returns all history (one tiny row per day) so streaks aren't capped at a year.
 */
export async function getActivity(from?: Day): Promise<ActivityInput> {
  const db = await getDb();
  const [attended, completions] = await Promise.all([
    db
      .select({ day: attendance.day })
      .from(attendance)
      .where(from ? gte(attendance.day, from) : undefined),
    db
      .select({ day: taskCompletions.day, done: count() })
      .from(taskCompletions)
      .where(from ? gte(taskCompletions.day, from) : undefined)
      .groupBy(taskCompletions.day),
  ]);

  return {
    attendedDays: new Set(attended.map((r) => r.day)),
    tasksByDay: new Map(completions.map((r) => [r.day, Number(r.done)])),
  };
}

export async function getAttendanceFor(day: Day): Promise<TodayAttendance | null> {
  const db = await getDb();
  const [row] = await db
    .select({ checkedInAt: attendance.checkedInAt })
    .from(attendance)
    .where(eq(attendance.day, day))
    .limit(1);
  return row ?? null;
}
