import { addDays, weekday, type Day } from "./dates";

/** Wall-clock helpers in the owner's timezone (Time Table, task completion days). */

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isTime(value: string): boolean {
  return TIME_RE.test(value);
}

/** Offset (ms) between UTC and `timeZone` at `instant`; positive east of UTC. */
export function timezoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** "2026-03-10" + "09:30" in Asia/Kolkata → the matching instant. */
export function zonedToUtc(day: Day, time: string, timeZone: string): Date {
  const m = TIME_RE.exec(time);
  if (!m) throw new Error(`Invalid time: ${time}`);
  const [y, mo, d] = day.split("-").map(Number);
  const guess = Date.UTC(y, mo - 1, d, Number(m[1]), Number(m[2]));
  const first = guess - timezoneOffsetMs(new Date(guess), timeZone);
  // Re-check once in case the guess crossed a DST change.
  const second = guess - timezoneOffsetMs(new Date(first), timeZone);
  return new Date(second);
}

/** "HH:MM" of an instant in `timeZone`. */
export function timeInZone(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(instant);
}

/** Monday of the week containing `day`. */
export function startOfWeek(day: Day): Day {
  return addDays(day, -((weekday(day) + 6) % 7));
}

export function minutesBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60_000);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}
