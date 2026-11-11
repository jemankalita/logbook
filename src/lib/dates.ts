/** Calendar days are plain "YYYY-MM-DD" strings in the owner's timezone. */
export type Day = string;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

export function isValidTimezone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** APP_TIMEZONE if it's a real IANA zone, otherwise the default (a typo shouldn't break every page). */
export function appTimezone(): string {
  const configured = process.env.APP_TIMEZONE;
  return configured && isValidTimezone(configured) ? configured : DEFAULT_TIMEZONE;
}

export function isDay(value: string): value is Day {
  return DAY_RE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** The calendar day of `now` as seen in `timeZone`. */
export function dayInTimezone(now: Date, timeZone: string): Day {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function today(): Day {
  return dayInTimezone(new Date(), appTimezone());
}

function toUtcMs(day: Day): number {
  if (!isDay(day)) throw new Error(`Invalid day: ${day}`);
  return Date.parse(`${day}T00:00:00Z`);
}

export function addDays(day: Day, n: number): Day {
  return new Date(toUtcMs(day) + n * MS_PER_DAY).toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(day: Day): number {
  return new Date(toUtcMs(day)).getUTCDay();
}

export function diffDays(a: Day, b: Day): number {
  return Math.round((toUtcMs(a) - toUtcMs(b)) / MS_PER_DAY);
}

export function formatDay(day: Day, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }): string {
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(new Date(toUtcMs(day)));
}
