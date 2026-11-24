import { addDays, formatDay, isDay, weekday, type Day } from "@/lib/dates";

/** Weeks run Monday → Sunday, so the review naturally happens over the weekend. */
export function weekStartOf(day: Day): Day {
  // weekday(): 0 = Sunday … 6 = Saturday → days since Monday
  return addDays(day, -((weekday(day) + 6) % 7));
}

export interface WeekRange {
  start: Day;
  end: Day;
  days: Day[];
  prev: Day;
  next: Day;
  /** last day of next week — "plan next week" looks at next..nextEnd */
  nextEnd: Day;
}

export function weekRange(start: Day): WeekRange {
  return {
    start,
    end: addDays(start, 6),
    days: Array.from({ length: 7 }, (_, i) => addDays(start, i)),
    prev: addDays(start, -7),
    next: addDays(start, 7),
    nextEnd: addDays(start, 13),
  };
}

/** `?week=` → that week's Monday; anything invalid or in the future → this week. */
export function parseWeekParam(value: string | undefined, today: Day): Day {
  const current = weekStartOf(today);
  if (!value || !isDay(value)) return current;
  const start = weekStartOf(value);
  return start > current ? current : start;
}

/** Settings key holding a week's reflection. */
export function reviewKey(start: Day): string {
  return `review:${start}`;
}

export function weekLabel(start: Day): string {
  const end = addDays(start, 6);
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  const from = formatDay(start, { month: "short", day: "numeric" });
  const to = formatDay(end, sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" });
  return `${from} – ${to}, ${end.slice(0, 4)}`;
}

/**
 * Consecutive reviewed weeks. The current week counts once reviewed, but an
 * unreviewed current week doesn't break the streak — you have until Sunday.
 */
export function reviewStreak(reviewed: ReadonlySet<Day>, currentWeek: Day): number {
  let cursor = reviewed.has(currentWeek) ? currentWeek : addDays(currentWeek, -7);
  let streak = 0;
  while (reviewed.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -7);
  }
  return streak;
}

export type ReviewPrompt = { state: "due" | "upcoming" | "done"; week: Day };

/** Weekday index from Monday = 0 … Sunday = 6. */
const dayOfWeek = (day: Day) => (weekday(day) + 6) % 7;
const LAST_WEEK_GRACE_DAYS = 2; // Mon–Wed may still review last week
const REVIEW_OPENS_ON = 4; // Friday

/** What the dashboard should nudge about: a skipped last week (early in the week), then this week from Friday. */
export function reviewPrompt(today: Day, reviewed: ReadonlySet<Day>): ReviewPrompt {
  const current = weekStartOf(today);
  const last = addDays(current, -7);
  const dow = dayOfWeek(today);
  if (reviewed.has(current)) return { state: "done", week: current };
  if (dow <= LAST_WEEK_GRACE_DAYS && !reviewed.has(last)) return { state: "due", week: last };
  if (dow >= REVIEW_OPENS_ON) return { state: "due", week: current };
  return { state: "upcoming", week: current };
}

export interface Reflection {
  wins: string;
  blockers: string;
  focus: string;
  /** ISO time the week was marked reviewed; null while it's a draft */
  reviewedAt: string | null;
}

export const EMPTY_REFLECTION: Reflection = { wins: "", blockers: "", focus: "", reviewedAt: null };

/** Settings values are untyped JSON — read them defensively. */
export function toReflection(value: unknown): Reflection {
  if (!value || typeof value !== "object") return EMPTY_REFLECTION;
  const v = value as Record<string, unknown>;
  const text = (x: unknown) => (typeof x === "string" ? x : "");
  return {
    wins: text(v.wins),
    blockers: text(v.blockers),
    focus: text(v.focus),
    reviewedAt: typeof v.reviewedAt === "string" ? v.reviewedAt : null,
  };
}
