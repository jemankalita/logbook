import type { CalendarItem } from "@/lib/calendar/items";
import { addDays, diffDays, formatDay, type Day } from "@/lib/dates";

/** Google-style compact times: "9am", "9:30am", "12pm". */
export function shortTime(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone }).formatToParts(new Date(iso));
  const hour = parts.find((p) => p.type === "hour")?.value ?? "";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  const period = (parts.find((p) => p.type === "dayPeriod")?.value ?? "").toLowerCase();
  return `${hour}${minute === "00" ? "" : `:${minute}`}${period}`;
}

/** "9 – 10am", "11am – 1pm" (the meridiem is only repeated when it changes). */
export function shortRange(start: string, end: string, timeZone: string): string {
  const a = shortTime(start, timeZone);
  const b = shortTime(end, timeZone);
  const pa = a.slice(-2);
  return pa === b.slice(-2) ? `${a.slice(0, -2)} – ${b}` : `${a} – ${b}`;
}

/** Full sentence for the event popover: "Monday, November 16 · 9 – 10am". */
export function describeWhen(item: CalendarItem, timeZone: string): string {
  if (item.allDay && item.startDay) {
    const lastDay = item.endDay && diffDays(item.endDay, item.startDay) > 1 ? addDays(item.endDay, -1) : null;
    const first = formatDay(item.startDay, { weekday: "long", month: "long", day: "numeric" });
    return lastDay ? `${formatDay(item.startDay, { month: "long", day: "numeric" })} – ${formatDay(lastDay, { month: "long", day: "numeric", year: "numeric" })}` : first;
  }
  const dayFmt = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone });
  const startDay = dayFmt.format(new Date(item.start));
  const endDay = dayFmt.format(new Date(item.end));
  if (startDay === endDay) return `${startDay} · ${shortRange(item.start, item.end, timeZone)}`;
  return `${startDay}, ${shortTime(item.start, timeZone)} – ${endDay}, ${shortTime(item.end, timeZone)}`;
}

/** "1 AM" … "11 PM" for the hour gutter. */
export function hourLabel(hour: number): string {
  if (hour === 0) return "";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h} ${hour < 12 ? "AM" : "PM"}`;
}

export const WEEKDAY_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export function dayNumber(day: Day): number {
  return Number(day.slice(8));
}
