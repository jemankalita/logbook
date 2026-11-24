import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import { addDays, type Day } from "@/lib/dates";
import { parseCalendar, type CalendarEvent } from "./parse";

export const CALENDAR_TAG = "calendar";
export const CALENDAR_REVALIDATE_SECONDS = 60 * 60; // hourly
export const AGENDA_DAYS = 14;
/** Longest range one request may ask for (a 6-week month grid, or the 30-day schedule). */
export const MAX_RANGE_DAYS = 42;

const FETCH_TIMEOUT_MS = 10_000;
const MAX_FEED_CHARS = 20 * 1024 * 1024;

export interface CalendarStatus {
  index: number;
  name: string;
  ok: boolean;
  /** user-facing reason; never contains the secret feed URL */
  error?: string;
}

export interface CalendarSnapshot {
  fetchedAt: string;
  calendars: CalendarStatus[];
  events: CalendarEvent[];
}

/**
 * Secret iCal addresses from GOOGLE_CALENDAR_ICS_URLS (comma/space/newline separated).
 * They grant read access to your calendar — they live only in env vars, never in the page.
 */
export function getFeedUrls(raw = process.env.GOOGLE_CALENDAR_ICS_URLS ?? ""): string[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => {
      try {
        return new URL(s).protocol === "https:";
      } catch {
        return false;
      }
    });
}

export function isCalendarConfigured(): boolean {
  return getFeedUrls().length > 0;
}

async function fetchFeed(url: string): Promise<string> {
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { accept: "text/calendar" },
  });
  if (!res.ok) {
    throw new Error(res.status === 404 ? "Feed not found — the secret address may have been reset." : `Google returned HTTP ${res.status}.`);
  }
  const text = await res.text();
  if (text.length > MAX_FEED_CHARS) throw new Error("Feed is too large.");
  if (!text.includes("BEGIN:VCALENDAR")) throw new Error("That address didn't return an iCal feed.");
  return text;
}

function describeError(err: unknown): string {
  if (err instanceof DOMException && err.name === "TimeoutError") return "Timed out reaching Google.";
  if (err instanceof Error && !/https?:\/\//.test(err.message)) return err.message;
  return "Couldn't load this calendar.";
}

async function loadSnapshot(firstDay: Day, dayCount: number): Promise<CalendarSnapshot> {
  const urls = getFeedUrls();
  // ±1 day of slack in UTC covers any timezone offset; the agenda trims to exact local days.
  const range = {
    start: new Date(`${addDays(firstDay, -1)}T00:00:00Z`),
    end: new Date(`${addDays(firstDay, dayCount + 1)}T00:00:00Z`),
  };

  const results = await Promise.allSettled(
    urls.map(async (url, i) => parseCalendar(await fetchFeed(url), range, i, `Calendar ${i + 1}`)),
  );

  const calendars: CalendarStatus[] = [];
  const events: CalendarEvent[] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      calendars.push({ index, name: result.value.name ?? `Calendar ${index + 1}`, ok: true });
      events.push(...result.value.events);
    } else {
      const error = describeError(result.reason);
      console.error(`[calendar] feed ${index + 1} failed: ${error}`);
      calendars.push({ index, name: `Calendar ${index + 1}`, ok: false, error });
    }
  });

  // Throwing keeps a total outage out of the hour-long cache, so the next visit retries.
  if (urls.length > 0 && calendars.every((c) => !c.ok)) {
    throw new Error(calendars[0]?.error ?? "Couldn't load your calendar.");
  }

  events.sort((a, b) => a.start.localeCompare(b.start));
  return { fetchedAt: new Date().toISOString(), calendars, events };
}

/**
 * The current hour as a cache-key part. `revalidate` alone is stale-while-revalidate: with one
 * visitor, a view opened a day later is first served the day-old snapshot. Keying by the hour
 * means an expired hour is a cache miss, so the page always shows data from this hour.
 */
export function cacheHour(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / (CALENDAR_REVALIDATE_SECONDS * 1000));
}

const cachedSnapshot = unstable_cache(
  // The last two arguments are never read: arguments form the cache key, so changing the URLs
  // or entering a new hour busts the cache.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (firstDay: Day, dayCount: number, _feedsKey: string, _hour: number) => loadSnapshot(firstDay, dayCount),
  ["calendar-snapshot-v3"],
  { revalidate: CALENDAR_REVALIDATE_SECONDS, tags: [CALENDAR_TAG] },
);

export type SnapshotResult =
  | { state: "unconfigured" }
  | { state: "ok"; snapshot: CalendarSnapshot }
  | { state: "error"; error: string };

/** Cached for an hour per range; the Refresh button busts it early. */
export async function getCalendarSnapshot(firstDay: Day, dayCount: number = AGENDA_DAYS): Promise<SnapshotResult> {
  const urls = getFeedUrls();
  if (urls.length === 0) return { state: "unconfigured" };
  const feedsKey = createHash("sha256").update(urls.join("\n")).digest("hex").slice(0, 16);
  try {
    const days = Math.min(Math.max(1, Math.round(dayCount)), MAX_RANGE_DAYS);
    return { state: "ok", snapshot: await cachedSnapshot(firstDay, days, feedsKey, cacheHour()) };
  } catch (err) {
    return { state: "error", error: describeError(err) };
  }
}
