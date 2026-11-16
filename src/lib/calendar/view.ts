import { addDays, diffDays, formatDay, isDay, weekday, type Day } from "@/lib/dates";

/** Google Calendar's views, with its keyboard shortcuts. */
export const CALENDAR_VIEWS = [
  { id: "day", label: "Day", key: "d" },
  { id: "week", label: "Week", key: "w" },
  { id: "month", label: "Month", key: "m" },
  { id: "4day", label: "4 days", key: "x" },
  { id: "schedule", label: "Schedule", key: "a" },
] as const;

export type CalendarView = (typeof CALENDAR_VIEWS)[number]["id"];

export const DEFAULT_VIEW: CalendarView = "week";
export const SCHEDULE_DAYS = 30;

export function parseView(value: string | undefined | null): CalendarView {
  return CALENDAR_VIEWS.some((v) => v.id === value) ? (value as CalendarView) : DEFAULT_VIEW;
}

export function parseAnchor(value: string | undefined | null, fallback: Day): Day {
  return value && isDay(value) ? value : fallback;
}

export interface ViewRange {
  view: CalendarView;
  anchor: Day;
  /** first visible day */
  first: Day;
  /** number of visible days */
  days: number;
  prev: Day;
  next: Day;
  title: string;
}

/** Sunday on/before `day` (Google's default week start). */
export function sundayOf(day: Day): Day {
  return addDays(day, -weekday(day));
}

const firstOfMonth = (day: Day): Day => `${day.slice(0, 7)}-01`;

/** Same day-of-month `n` months away, clamped (Jan 31 + 1 month → Feb 28). */
export function addMonths(day: Day, n: number): Day {
  const [y, m, d] = day.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** The Sunday-start weeks covering the month of `day`: 4–6 rows, like Google's month grid. */
export function monthGrid(day: Day): { first: Day; days: number } {
  const start = firstOfMonth(day);
  const nextMonth = firstOfMonth(addMonths(start, 1));
  const first = sundayOf(start);
  const weeks = Math.ceil(diffDays(nextMonth, first) / 7);
  return { first, days: weeks * 7 };
}

const monthYear = (day: Day) => formatDay(day, { month: "long", year: "numeric" });

/** "November 2026", "Nov – Dec 2026", "Dec 2026 – Jan 2027" — how Google titles a span of days. */
export function spanTitle(first: Day, last: Day): string {
  if (first.slice(0, 7) === last.slice(0, 7)) return monthYear(first);
  if (first.slice(0, 4) === last.slice(0, 4)) return `${formatDay(first, { month: "short" })} – ${formatDay(last, { month: "short", year: "numeric" })}`;
  return `${formatDay(first, { month: "short", year: "numeric" })} – ${formatDay(last, { month: "short", year: "numeric" })}`;
}

export function viewRange(view: CalendarView, anchor: Day): ViewRange {
  switch (view) {
    case "day":
      return { view, anchor, first: anchor, days: 1, prev: addDays(anchor, -1), next: addDays(anchor, 1), title: formatDay(anchor, { month: "long", day: "numeric", year: "numeric" }) };
    case "4day":
      return { view, anchor, first: anchor, days: 4, prev: addDays(anchor, -4), next: addDays(anchor, 4), title: spanTitle(anchor, addDays(anchor, 3)) };
    case "month": {
      const { first, days } = monthGrid(anchor);
      return { view, anchor, first, days, prev: addMonths(anchor, -1), next: addMonths(anchor, 1), title: monthYear(anchor) };
    }
    case "schedule":
      return { view, anchor, first: anchor, days: SCHEDULE_DAYS, prev: addDays(anchor, -SCHEDULE_DAYS), next: addDays(anchor, SCHEDULE_DAYS), title: spanTitle(anchor, addDays(anchor, SCHEDULE_DAYS - 1)) };
    case "week": {
      const first = sundayOf(anchor);
      return { view, anchor, first, days: 7, prev: addDays(anchor, -7), next: addDays(anchor, 7), title: spanTitle(first, addDays(first, 6)) };
    }
  }
}

export function calendarHref(view: CalendarView, day: Day): string {
  return `/calendar?view=${view}&date=${day}`;
}
