import { addDays, diffDays, weekday, type Day } from "@/lib/dates";

/**
 * How a habit repeats (stored in tasks.recurrence):
 *   "daily" | "weekdays" (Mon–Fri) | "weekly" (same weekday as it started) | "days:1,3,5" (0 = Sun … 6 = Sat)
 * null = a one-off task.
 */
export type Recurrence = "daily" | "weekdays" | "weekly" | `days:${string}`;

export const RECURRENCE_LABELS: Record<string, string> = {
  daily: "Every day",
  weekdays: "Weekdays",
  weekly: "Weekly",
};

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function parseRecurrence(value: string | null | undefined): Recurrence | null {
  if (!value) return null;
  if (value === "daily" || value === "weekdays" || value === "weekly") return value;
  const days = parseDays(value);
  return days ? (`days:${days.join(",")}` as Recurrence) : null;
}

function parseDays(value: string): number[] | null {
  const m = /^days:([0-6](?:,[0-6])*)$/.exec(value);
  if (!m) return null;
  return [...new Set(m[1].split(",").map(Number))].sort();
}

export function describeRecurrence(value: string | null | undefined): string {
  const r = parseRecurrence(value);
  if (!r) return "";
  if (r in RECURRENCE_LABELS) return RECURRENCE_LABELS[r];
  return (parseDays(r) ?? []).map((d) => WEEKDAY_SHORT[d]).join(", ");
}

/** Does a habit that started on `start` happen on `day`? */
export function occursOn(recurrence: string | null | undefined, start: Day, day: Day): boolean {
  const r = parseRecurrence(recurrence);
  if (!r || diffDays(day, start) < 0) return false;
  const wd = weekday(day);
  if (r === "daily") return true;
  if (r === "weekdays") return wd >= 1 && wd <= 5;
  if (r === "weekly") return wd === weekday(start);
  return (parseDays(r) ?? []).includes(wd);
}

/**
 * Consecutive scheduled occurrences completed, counting back from today.
 * Today not being done yet doesn't break the streak; skipping a scheduled day does.
 */
export function habitStreak(recurrence: string | null | undefined, start: Day, doneDays: ReadonlySet<Day>, today: Day, maxLookback = 400): number {
  let streak = 0;
  for (let i = 0; i < maxLookback; i++) {
    const day = addDays(today, -i);
    if (diffDays(day, start) < 0) break;
    if (!occursOn(recurrence, start, day)) continue;
    if (doneDays.has(day)) streak++;
    else if (day !== today) break;
  }
  return streak;
}
