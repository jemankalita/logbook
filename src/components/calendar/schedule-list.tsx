"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CalendarCheck2 } from "lucide-react";
import type { CalendarItem } from "@/lib/calendar/items";
import { coveredDays } from "@/lib/calendar/layout";
import { addDays, diffDays, formatDay, type Day } from "@/lib/dates";
import { dayNumber, shortRange } from "./format";
import type { GridCommon } from "./time-grid";
import { EmojiText } from "../emoji";

/** Google's Schedule view: only days that have something; all-day items first, then by start time. */
export function ScheduleList({ first, days, items, today, timeZone, now, colorOf, onOpen, dayHref }: GridCommon & { first: Day; days: number }) {
  const groups = useMemo(() => {
    const byDay = new Map<Day, CalendarItem[]>();
    for (const item of items) {
      const { start, end } = coveredDays(item, timeZone);
      for (let d = start; diffDays(end, d) > 0; d = addDays(d, 1)) {
        const offset = diffDays(d, first);
        if (offset < 0) continue;
        if (offset >= days) break;
        byDay.set(d, [...(byDay.get(d) ?? []), item]);
      }
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, list]) => ({ day, list: list.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start)) }));
  }, [items, first, days, timeZone]);

  if (groups.length === 0) {
    return (
      <div className="grid h-full place-items-center p-10 text-center">
        <div>
          <CalendarCheck2 className="mx-auto size-10 text-faint" aria-hidden />
          <p className="mt-3 font-medium">Nothing on the calendar</p>
          <p className="mt-1 text-sm text-muted">No events, deadlines or blocks in the next {days} days.</p>
        </div>
      </div>
    );
  }

  return (
    <ol className="h-full overflow-y-auto px-2 py-2 md:px-4">
      {groups.map(({ day, list }) => {
        const isToday = day === today;
        return (
          <li key={day} className="grid grid-cols-[4.5rem_1fr] gap-x-3 border-b border-line py-2 last:border-b-0 md:grid-cols-[7.5rem_1fr]">
            <Link href={dayHref(day)} className="group flex items-start gap-2 pt-1" aria-current={isToday ? "date" : undefined}>
              <span className={`tabular grid size-8 shrink-0 place-items-center rounded-full text-[15px] font-medium transition-colors duration-150 ${isToday ? "bg-accent text-accent-ink" : "group-hover:bg-panel-2"}`}>{dayNumber(day)}</span>
              <span className={`hidden pt-2 text-[11px] font-medium uppercase tracking-[0.06em] md:block ${isToday ? "text-accent" : "text-muted"}`}>{formatDay(day, { month: "short", weekday: "short" })}</span>
            </Link>
            <ul className="min-w-0">
              {list.map((item) => {
                const past = new Date(item.end) <= now;
                return (
                  <li key={`${day}-${item.id}`}>
                    <button
                      type="button"
                      onClick={(e) => onOpen(item, e.currentTarget)}
                      className={`grid w-full grid-cols-[0.75rem_7.5rem_1fr] items-center gap-x-3 rounded-lg px-2 py-2 text-left text-sm transition-colors duration-150 hover:bg-panel-2 ${past || item.done ? "text-muted" : ""}`}
                    >
                      <span aria-hidden className="size-2.5 rounded-full" style={{ background: colorOf(item) }} />
                      <span className="tabular truncate text-[13px] text-muted">{item.allDay ? "All day" : shortRange(item.start, item.end, timeZone)}</span>
                      <EmojiText text={item.title} className={`truncate font-medium ${item.done ? "line-through" : ""}`} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
