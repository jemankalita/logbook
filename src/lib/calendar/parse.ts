import ICAL from "ical.js";
import type { Day } from "@/lib/dates";

export interface CalendarEvent {
  id: string;
  calendarIndex: number;
  calendarName: string;
  title: string;
  /** ISO instant; for all-day events, midnight UTC of startDay */
  start: string;
  end: string;
  allDay: boolean;
  /** all-day only: first day and exclusive end day */
  startDay?: Day;
  endDay?: Day;
  location?: string;
}

export interface ParsedCalendar {
  name: string | null;
  events: CalendarEvent[];
}

export interface Range {
  start: Date;
  end: Date;
}

/** Stops runaway expansion of very old daily recurrences. */
const MAX_OCCURRENCES_PER_EVENT = 5000;

type IcalTime = InstanceType<typeof ICAL.Time>;
type IcalEvent = InstanceType<typeof ICAL.Event>;

function toInstant(time: IcalTime): Date {
  // All-day dates have no timezone; anchor them at UTC midnight so they're stable everywhere.
  return time.isDate ? new Date(`${time.toString()}T00:00:00Z`) : time.toJSDate();
}

function isCancelled(event: IcalEvent): boolean {
  return String(event.component.getFirstPropertyValue("status") ?? "").toUpperCase() === "CANCELLED";
}

function overlaps(start: Date, end: Date, range: Range): boolean {
  return start < range.end && end > range.start;
}

function buildEvent(
  item: IcalEvent,
  startTime: IcalTime,
  endTime: IcalTime,
  calendarIndex: number,
  calendarName: string,
): CalendarEvent {
  const start = toInstant(startTime);
  const end = toInstant(endTime);
  const allDay = startTime.isDate;
  return {
    id: `${calendarIndex}:${item.uid}:${start.toISOString()}`,
    calendarIndex,
    calendarName,
    title: item.summary?.trim() || "(No title)",
    start: start.toISOString(),
    end: (end > start ? end : start).toISOString(),
    allDay,
    ...(allDay ? { startDay: startTime.toString(), endDay: endTime.toString() } : {}),
    ...(item.location ? { location: item.location } : {}),
  };
}

/**
 * Parse an iCalendar feed (e.g. Google's "secret address in iCal format") and
 * return the event occurrences overlapping `range`, with recurrences expanded
 * and moved/cancelled instances applied.
 */
export function parseCalendar(icsText: string, range: Range, calendarIndex: number, fallbackName: string): ParsedCalendar {
  const root = new ICAL.Component(ICAL.parse(icsText));
  const name = (root.getFirstPropertyValue("x-wr-calname") as string | null) ?? null;
  const calendarName = name || fallbackName;

  for (const vtz of root.getAllSubcomponents("vtimezone")) {
    ICAL.TimezoneService.register(vtz);
  }

  const all = root.getAllSubcomponents("vevent").map((c) => new ICAL.Event(c));
  const masters = new Map<string, IcalEvent>();
  const exceptions: IcalEvent[] = [];
  for (const ev of all) {
    if (ev.isRecurrenceException()) exceptions.push(ev);
    else masters.set(ev.uid, ev);
  }
  for (const ex of exceptions) {
    const master = masters.get(ex.uid);
    if (master) master.relateException(ex);
    else masters.set(`${ex.uid}:${ex.recurrenceId.toString()}`, ex); // orphaned override → standalone
  }

  const events: CalendarEvent[] = [];
  for (const master of masters.values()) {
    if (!master.startDate) continue;

    if (!master.isRecurring()) {
      if (isCancelled(master)) continue;
      const endTime = master.endDate ?? master.startDate;
      if (overlaps(toInstant(master.startDate), toInstant(endTime), range)) {
        events.push(buildEvent(master, master.startDate, endTime, calendarIndex, calendarName));
      }
      continue;
    }

    const iterator = master.iterator();
    for (let i = 0, next = iterator.next(); next && i < MAX_OCCURRENCES_PER_EVENT; i++, next = iterator.next()) {
      if (toInstant(next) >= range.end) break;
      const details = master.getOccurrenceDetails(next);
      if (isCancelled(details.item)) continue;
      if (overlaps(toInstant(details.startDate), toInstant(details.endDate), range)) {
        events.push(buildEvent(details.item, details.startDate, details.endDate, calendarIndex, calendarName));
      }
    }
  }

  events.sort((a, b) => a.start.localeCompare(b.start) || Number(b.allDay) - Number(a.allDay));
  return { name, events };
}
