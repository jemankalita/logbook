import { and, count, eq, gte, isNotNull, notInArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { attendance, items, journal, opportunities, taskCompletions, timeBlocks } from "@/db/schema";
import { addDays, appTimezone, dayInTimezone, diffDays, formatDay, type Day } from "@/lib/dates";
import { OPP_STATUS_LABELS, OPP_STATUSES } from "@/lib/opportunity-meta";
import { minutesBetween, startOfWeek, zonedToUtc } from "@/lib/time";

export interface WeekPoint {
  week: Day;
  label: string;
  value: number;
}

export interface NamedValue {
  name: string;
  value: number;
}

export interface Insights {
  tasksPerWeek: WeekPoint[];
  linksPerWeek: WeekPoint[];
  attendancePerWeek: WeekPoint[];
  libraryByType: NamedValue[];
  oppsByStage: NamedValue[];
  hoursByArea: NamedValue[];
  mood: { day: Day; label: string; mood: number }[];
  totals: { links: number; notes: number; tasksDone30: number; journal30: number; activeOpps: number };
}

export const INSIGHT_WEEKS = 26;
const AREA_DAYS = 28;
const MOOD_DAYS = 90;

/** Count days into Monday-starting weeks, oldest first, ending with the current week. */
export function weeklyCounts(days: Iterable<Day>, today: Day, weeks = INSIGHT_WEEKS): WeekPoint[] {
  const thisWeek = startOfWeek(today);
  const first = addDays(thisWeek, -(weeks - 1) * 7);
  const counts = new Array<number>(weeks).fill(0);
  for (const d of days) {
    const idx = Math.floor(diffDays(d, first) / 7);
    if (idx >= 0 && idx < weeks) counts[idx]++;
  }
  return counts.map((value, i) => {
    const week = addDays(first, i * 7);
    return { week, label: formatDay(week, { month: "short", day: "numeric" }), value };
  });
}

const TYPE_NAMES: Record<string, string> = { article: "Articles", course: "Courses", video: "Videos", tool: "Tools", idea: "Ideas", note: "Notes", tweet: "X posts", other: "Other links" };

export async function getInsights(today: Day): Promise<Insights> {
  const db = await getDb();
  const tz = appTimezone();
  const since = addDays(startOfWeek(today), -(INSIGHT_WEEKS - 1) * 7);
  const sinceInstant = new Date(`${addDays(since, -1)}T00:00:00Z`);

  const [completions, linkDates, attended, types, stages, blocks, moods, [notes], [journalCount], [active]] = await Promise.all([
    db.select({ day: taskCompletions.day }).from(taskCompletions).where(gte(taskCompletions.day, since)),
    db.select({ createdAt: items.createdAt }).from(items).where(and(eq(items.kind, "link"), gte(items.createdAt, sinceInstant))),
    db.select({ day: attendance.day }).from(attendance).where(gte(attendance.day, since)),
    db.select({ type: items.type, n: count() }).from(items).where(eq(items.kind, "link")).groupBy(items.type),
    db.select({ status: opportunities.status, n: count() }).from(opportunities).groupBy(opportunities.status),
    db
      .select({ area: timeBlocks.area, startsAt: timeBlocks.startsAt, endsAt: timeBlocks.endsAt })
      .from(timeBlocks)
      // Exactly AREA_DAYS days including today, from local midnight in the app's timezone.
      .where(and(eq(timeBlocks.done, true), gte(timeBlocks.startsAt, zonedToUtc(addDays(today, -(AREA_DAYS - 1)), "00:00", tz)))),
    db.select({ day: journal.day, mood: journal.mood }).from(journal).where(and(isNotNull(journal.mood), gte(journal.day, addDays(today, -MOOD_DAYS)))),
    db.select({ n: count() }).from(items).where(eq(items.kind, "note")),
    db.select({ n: count() }).from(journal).where(and(isNotNull(journal.bodyText), gte(journal.day, addDays(today, -29)))),
    db.select({ n: count() }).from(opportunities).where(notInArray(opportunities.status, ["result", "closed"])),
  ]);

  const minutesByArea = new Map<string, number>();
  for (const b of blocks) {
    const key = b.area ?? "other";
    minutesByArea.set(key, (minutesByArea.get(key) ?? 0) + minutesBetween(b.startsAt, b.endsAt));
  }
  const stageCounts = new Map(stages.map((s) => [s.status, Number(s.n)]));
  const tasksDone30 = completions.filter((c) => diffDays(today, c.day) < 30).length;

  return {
    tasksPerWeek: weeklyCounts(completions.map((c) => c.day), today),
    linksPerWeek: weeklyCounts(linkDates.map((l) => dayInTimezone(l.createdAt, tz)), today),
    attendancePerWeek: weeklyCounts(attended.map((a) => a.day), today),
    libraryByType: types.map((t) => ({ name: TYPE_NAMES[t.type] ?? t.type, value: Number(t.n) })).sort((a, b) => b.value - a.value),
    oppsByStage: OPP_STATUSES.filter((s) => s !== "closed").map((s) => ({ name: OPP_STATUS_LABELS[s], value: stageCounts.get(s) ?? 0 })),
    hoursByArea: [...minutesByArea.entries()].map(([name, m]) => ({ name, value: Math.round((m / 60) * 10) / 10 })).sort((a, b) => b.value - a.value),
    mood: moods
      .map((m) => ({ day: m.day, label: formatDay(m.day, { month: "short", day: "numeric" }), mood: m.mood as number }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    totals: {
      links: types.reduce((s, t) => s + Number(t.n), 0),
      notes: Number(notes?.n ?? 0),
      tasksDone30,
      journal30: Number(journalCount?.n ?? 0),
      activeOpps: Number(active?.n ?? 0),
    },
  };
}
