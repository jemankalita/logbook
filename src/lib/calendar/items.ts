import type { Day } from "@/lib/dates";
import type { CalendarEvent } from "./parse";

/**
 * What the calendar page draws: Google events plus Logbook's own dated things (tasks, opportunity
 * deadlines, Time Table blocks), all normalised to one shape. Safe to send to the client — no feed URLs.
 */
export interface CalendarItem {
  id: string;
  sourceId: string;
  title: string;
  /** ISO instants; all-day items use midnight UTC of startDay, as parse.ts does. */
  start: string;
  end: string;
  allDay: boolean;
  startDay?: Day;
  /** exclusive */
  endDay?: Day;
  location?: string;
  /** In-app page for this item (tasks, opportunities, time blocks). */
  href?: string;
  done?: boolean;
  /** Small secondary line in the popover ("Next: submit essay"). */
  detail?: string;
}

export type SourceKind = "google" | "tasks" | "deadlines" | "timetable";

export interface CalendarSource {
  id: string;
  name: string;
  color: string;
  kind: SourceKind;
  ok: boolean;
  error?: string;
}

/** Google Calendar's own event palette: Peacock, Sage, Grape, Flamingo, Banana, Tangerine. */
export const GOOGLE_PALETTE = ["#039be5", "#33b679", "#8e24aa", "#e67c73", "#f6bf26", "#f4511e"] as const;

/** Logbook's built-in calendars, also in Google's palette: Blueberry, Tomato, Basil. */
export const LOCAL_SOURCES: Record<Exclude<SourceKind, "google">, Omit<CalendarSource, "ok">> = {
  tasks: { id: "logbook:tasks", name: "Tasks", color: "#3f51b5", kind: "tasks" },
  deadlines: { id: "logbook:deadlines", name: "Deadlines", color: "#d50000", kind: "deadlines" },
  timetable: { id: "logbook:timetable", name: "Time Table", color: "#0b8043", kind: "timetable" },
};

export const googleSourceId = (index: number) => `google:${index}`;

export function googleColor(index: number): string {
  return GOOGLE_PALETTE[index % GOOGLE_PALETTE.length];
}

export function fromGoogleEvent(e: CalendarEvent): CalendarItem {
  return {
    id: e.id,
    sourceId: googleSourceId(e.calendarIndex),
    title: e.title,
    start: e.start,
    end: e.end,
    allDay: e.allDay,
    startDay: e.startDay,
    endDay: e.endDay,
    location: e.location,
  };
}

/** An all-day item from `day` up to exclusive `endDay`, anchored like parse.ts anchors all-day events. */
export function allDayItem(fields: Omit<CalendarItem, "start" | "end" | "allDay" | "startDay" | "endDay">, day: Day, endDay: Day): CalendarItem {
  return { ...fields, allDay: true, startDay: day, endDay, start: `${day}T00:00:00.000Z`, end: `${endDay}T00:00:00.000Z` };
}

/** White or near-black text, whichever reads better on a solid `hex` fill (WCAG relative luminance). */
export function inkOn(hex: string): string {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  // Contrast vs white = 1.05 / (lum + .05); vs black = (lum + .05) / .05 — pick the larger.
  return 1.05 / (lum + 0.05) >= (lum + 0.05) / 0.05 ? "#ffffff" : "#1f1f1f";
}
