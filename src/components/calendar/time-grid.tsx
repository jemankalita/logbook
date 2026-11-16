"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { inkOn, type CalendarItem } from "@/lib/calendar/items";
import { countPerColumn, isSpanning, layoutSpans, layoutTimedDay, MIN_EVENT_MINUTES, type SpanBar, type TimedSegment } from "@/lib/calendar/layout";
import { weekday, type Day } from "@/lib/dates";
import { zonedToUtc } from "@/lib/time";
import { dayNumber, hourLabel, shortRange, shortTime, WEEKDAY_SHORT } from "./format";
import { EmojiText } from "../emoji";

export const HOUR_PX = 48;
const ROW_PX = 24;
const COLLAPSED_ROWS = 3;
const HOURS = Array.from({ length: 24 }, (_, h) => h);

export interface GridCommon {
  items: CalendarItem[];
  today: Day;
  timeZone: string;
  now: Date;
  colorOf: (item: CalendarItem) => string;
  onOpen: (item: CalendarItem, el: HTMLElement) => void;
  dayHref: (day: Day) => string;
}

/** "GMT+05:30" for the corner of the grid, like Google. */
function zoneLabel(timeZone: string, at: Date): string {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value;
  return name === "GMT" ? "GMT+00" : (name ?? "");
}

export function TimeGrid({ days, items, today, timeZone, now, colorOf, onOpen, dayHref }: GridCommon & { days: Day[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const cols = `4.25rem repeat(${days.length}, minmax(0, 1fr))`;

  const spanning = useMemo(() => items.filter(isSpanning), [items]);
  const bars = useMemo(() => layoutSpans(spanning, days[0], days.length, timeZone), [spanning, days, timeZone]);
  const perColumn = useMemo(() => countPerColumn(bars, days.length), [bars, days.length]);
  const segments = useMemo(() => days.map((d) => layoutTimedDay(items, d, timeZone)), [items, days, timeZone]);

  const rowCount = bars.reduce((m, b) => Math.max(m, b.row + 1), 0);
  const collapsible = rowCount > COLLAPSED_ROWS;
  const visibleRows = !collapsible || expanded ? rowCount : COLLAPSED_ROWS - 1;
  const stripRows = collapsible && !expanded ? COLLAPSED_ROWS : rowCount;

  const nowMinutes = (now.getTime() - zonedToUtc(today, "00:00", timeZone).getTime()) / 60_000;
  const todayCol = days.indexOf(today);

  // Open at the current time (or 7 AM), the way Google does.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const target = todayCol >= 0 ? nowMinutes - 120 : 7 * 60;
    el.scrollTop = Math.max(0, (target / 60) * HOUR_PX);
    // only when the visible range changes, not every minute
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days[0], days.length]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Day headings */}
      <div className="grid shrink-0 overflow-hidden [scrollbar-gutter:stable]" style={{ gridTemplateColumns: cols }}>
        <div className="flex items-end justify-end pb-1.5 pr-2 text-[10px] text-faint">{zoneLabel(timeZone, now)}</div>
        {days.map((d) => {
          const isToday = d === today;
          return (
            <div key={d} className="flex flex-col items-center gap-0.5 pb-2 pt-1">
              <span className={`text-[11px] font-medium tracking-[0.06em] ${isToday ? "text-accent" : "text-muted"}`}>{WEEKDAY_SHORT[weekday(d)]}</span>
              <Link
                href={dayHref(d)}
                aria-label={`Open ${d}`}
                aria-current={isToday ? "date" : undefined}
                className={`tabular grid size-11 place-items-center rounded-full text-[1.6rem] leading-none transition-colors duration-150 ${isToday ? "bg-accent text-accent-ink hover:bg-accent/85" : "text-fg hover:bg-panel-2"}`}
              >
                {dayNumber(d)}
              </Link>
            </div>
          );
        })}
      </div>

      {/* All-day strip */}
      <div className="relative grid shrink-0 overflow-hidden border-b border-line [scrollbar-gutter:stable]" style={{ gridTemplateColumns: cols }}>
        <div className="flex items-start justify-end border-r border-line pr-1.5 pt-1" style={{ minHeight: Math.max(1, stripRows) * ROW_PX + 8 }}>
          {collapsible ? (
            <button type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} aria-label={expanded ? "Show fewer all-day events" : "Show all all-day events"} className="grid size-6 place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-panel-2 hover:text-fg">
              <ChevronDown className={`size-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} aria-hidden />
            </button>
          ) : null}
        </div>
        {days.map((d, i) => (
          <div key={d} className={i > 0 ? "border-l border-line" : ""} />
        ))}
        <div className="pointer-events-none absolute inset-y-0 right-0 left-[4.25rem] py-1">
          {bars
            .filter((b) => b.row < visibleRows)
            .map((b) => (
              <SpanChip key={`${b.item.id}-${b.startCol}`} bar={b} days={days.length} color={colorOf(b.item)} timeZone={timeZone} onOpen={onOpen} />
            ))}
          {collapsible && !expanded
            ? perColumn.map((count, c) => {
                const hidden = count - bars.filter((b) => b.row < visibleRows && c >= b.startCol && c < b.startCol + b.span).length;
                return hidden > 0 ? (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setExpanded(true)}
                    className="pointer-events-auto absolute truncate rounded px-1.5 text-left text-[12px] font-medium text-muted hover:bg-panel-2 hover:text-fg"
                    style={{ top: 4 + visibleRows * ROW_PX, left: `calc(${(c / days.length) * 100}% + 2px)`, width: `calc(${100 / days.length}% - 6px)`, height: ROW_PX - 2 }}
                  >
                    {hidden} more
                  </button>
                ) : null;
              })
            : null}
        </div>
      </div>

      {/* Hours */}
      <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
        <div className="relative grid" style={{ gridTemplateColumns: cols, height: 24 * HOUR_PX }}>
          <div className="relative border-r border-line">
            {HOURS.map((h) => (
              <span key={h} className="tabular absolute right-2 -translate-y-1/2 text-[10px] text-faint" style={{ top: h * HOUR_PX }}>
                {hourLabel(h)}
              </span>
            ))}
          </div>
          {days.map((d, i) => (
            <div
              key={d}
              className={`relative ${i > 0 ? "border-l border-line" : ""}`}
              style={{ backgroundImage: `linear-gradient(to bottom, var(--line) 1px, transparent 1px)`, backgroundSize: `100% ${HOUR_PX}px` }}
            >
              {segments[i].map((s) => (
                <TimedChip key={`${s.item.id}-${d}`} seg={s} color={colorOf(s.item)} timeZone={timeZone} now={now} onOpen={onOpen} />
              ))}
              {i === todayCol && nowMinutes >= 0 && nowMinutes < 1440 ? (
                <div aria-hidden className="pointer-events-none absolute inset-x-0 z-20" style={{ top: (nowMinutes / 60) * HOUR_PX }}>
                  <div className="absolute -left-1.5 -top-1.5 size-3 rounded-full bg-[#ea4335]" />
                  <div className="h-0.5 -translate-y-1/2 bg-[#ea4335]" />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SpanChip({
  bar,
  days,
  color,
  timeZone,
  onOpen,
}: {
  bar: SpanBar<CalendarItem>;
  days: number;
  color: string;
  timeZone: string;
  onOpen: GridCommon["onOpen"];
}) {
  const { item } = bar;
  return (
    <button
      type="button"
      onClick={(e) => onOpen(item, e.currentTarget)}
      className={`pointer-events-auto absolute flex items-center truncate px-2 text-left text-[12px] font-medium transition-[filter] duration-150 hover:brightness-110 ${bar.continuesBefore ? "rounded-l-none" : "rounded-l-md"} ${bar.continuesAfter ? "rounded-r-none" : "rounded-r-md"} ${item.done ? "opacity-60" : ""}`}
      style={{
        top: 4 + bar.row * ROW_PX,
        height: ROW_PX - 2,
        left: `calc(${(bar.startCol / days) * 100}% + ${bar.continuesBefore ? 0 : 2}px)`,
        width: `calc(${(bar.span / days) * 100}% - ${bar.continuesAfter ? 2 : 6}px)`,
        background: color,
        color: inkOn(color),
      }}
    >
      <span className={`truncate ${item.done ? "line-through" : ""}`}>
        {!item.allDay ? `${shortTime(item.start, timeZone)} ` : ""}
        <EmojiText text={item.title} />
      </span>
    </button>
  );
}

function TimedChip({ seg, color, timeZone, now, onOpen }: { seg: TimedSegment<CalendarItem>; color: string; timeZone: string; now: Date; onOpen: GridCommon["onOpen"] }) {
  const { item } = seg;
  const minutes = Math.max(seg.endMin - seg.startMin, MIN_EVENT_MINUTES);
  const compact = minutes < 45;
  const past = new Date(item.end) <= now;
  return (
    <button
      type="button"
      onClick={(e) => onOpen(item, e.currentTarget)}
      className={`absolute z-10 overflow-hidden rounded-md px-1.5 text-left text-[12px] leading-[1.25] shadow-[0_0_0_1px_var(--panel)] transition-[filter,box-shadow] duration-150 hover:z-30 hover:brightness-110 focus-visible:z-30 ${compact ? "py-0" : "py-1"} ${past || item.done ? "opacity-60" : ""}`}
      style={{
        top: (seg.startMin / 60) * HOUR_PX + 1,
        height: (minutes / 60) * HOUR_PX - 2,
        left: `calc(${(seg.col / seg.cols) * 100}% + 1px)`,
        width: `calc(${(1 / seg.cols) * 100}% - ${seg.col === seg.cols - 1 ? 10 : 3}px)`,
        background: color,
        color: inkOn(color),
      }}
    >
      {compact ? (
        <span className="block truncate">
          <EmojiText text={item.title} className={`font-medium ${item.done ? "line-through" : ""}`} />, {shortTime(item.start, timeZone)}
        </span>
      ) : (
        <>
          <span className={`block font-medium ${item.done ? "line-through" : ""} ${minutes < 75 ? "truncate" : "line-clamp-2"}`}><EmojiText text={item.title} /></span>
          <span className="block truncate opacity-90">{shortRange(item.start, item.end, timeZone)}</span>
          {item.location && minutes >= 90 ? <span className="block truncate opacity-80">{item.location}</span> : null}
        </>
      )}
    </button>
  );
}
