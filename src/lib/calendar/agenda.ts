import { addDays, dayInTimezone, diffDays, type Day } from "@/lib/dates";
import type { CalendarEvent } from "./parse";
import { googleColor } from "./items";

export interface AgendaDay {
  day: Day;
  allDay: CalendarEvent[];
  timed: CalendarEvent[];
}

/** Does an all-day event cover `day`? (endDay is exclusive, as in iCalendar) */
function coversDay(event: CalendarEvent, day: Day): boolean {
  if (!event.startDay) return false;
  const endDay = event.endDay && diffDays(event.endDay, event.startDay) > 0 ? event.endDay : addDays(event.startDay, 1);
  return diffDays(day, event.startDay) >= 0 && diffDays(endDay, day) > 0;
}

/**
 * Bucket events into `dayCount` consecutive days starting at `firstDay`, in the
 * owner's timezone. Timed events land on the day they start; multi-day all-day
 * events appear on every day they cover.
 */
export function buildAgenda(events: readonly CalendarEvent[], firstDay: Day, dayCount: number, timeZone: string): AgendaDay[] {
  const days: AgendaDay[] = Array.from({ length: dayCount }, (_, i) => ({ day: addDays(firstDay, i), allDay: [], timed: [] }));
  const index = new Map(days.map((d) => [d.day, d]));

  for (const event of events) {
    if (event.allDay) {
      for (const bucket of days) if (coversDay(event, bucket.day)) bucket.allDay.push(event);
    } else {
      index.get(dayInTimezone(new Date(event.start), timeZone))?.timed.push(event);
    }
  }
  for (const bucket of days) bucket.timed.sort((a, b) => a.start.localeCompare(b.start));
  return days;
}

export function formatTimeRange(event: CalendarEvent, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone });
  return `${fmt.format(new Date(event.start))} – ${fmt.format(new Date(event.end))}`;
}

/** Is a timed event happening at `now`? */
export function isHappeningNow(event: CalendarEvent, now: Date): boolean {
  return !event.allDay && new Date(event.start) <= now && now < new Date(event.end);
}

/** Same palette as the calendar page (Google's own event colours). */
export function calendarColor(index: number): string {
  return googleColor(index);
}
