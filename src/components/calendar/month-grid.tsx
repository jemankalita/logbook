"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { inkOn, type CalendarItem } from "@/lib/calendar/items";
import { countPerColumn, isSpanning, layoutSpans, type SpanBar } from "@/lib/calendar/layout";
import { addDays, type Day } from "@/lib/dates";
import { dayNumber, shortTime, WEEKDAY_SHORT } from "./format";
import type { GridCommon } from "./time-grid";
import { EmojiText } from "../emoji";

const LINE_PX = 22;
const HEAD_PX = 30;
const FALLBACK_LINES = 4;

/** Google's month view: whole weeks, multi-day bars across the row, "+N more" when a day overflows. */
export function MonthGrid({ first, days, month, items, today, timeZone, now, colorOf, onOpen, dayHref }: GridCommon & { first: Day; days: number; month: string }) {
  const weeks = days / 7;
  const body = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState(FALLBACK_LINES);

  // Fit as many event lines as each row has room for.
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    const measure = () => setLines(Math.max(1, Math.floor((el.clientHeight / weeks - HEAD_PX - 4) / LINE_PX)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [weeks]);

  const rows = useMemo(
    () =>
      Array.from({ length: weeks }, (_, w) => {
        const start = addDays(first, w * 7);
        const bars = layoutSpans(items, start, 7, timeZone);
        return { start, bars, counts: countPerColumn(bars, 7) };
      }),
    [weeks, first, items, timeZone],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid shrink-0 grid-cols-7 border-b border-line">
        {WEEKDAY_SHORT.map((d) => (
          <div key={d} className="py-2 text-center text-[11px] font-medium tracking-[0.06em] text-muted">
            {d}
          </div>
        ))}
      </div>
      <div ref={body} className="grid min-h-0 flex-1" style={{ gridTemplateRows: `repeat(${weeks}, minmax(5.5rem, 1fr))` }}>
        {rows.map(({ start, bars, counts }) => {
          const overflow = counts.map((c) => c > lines);
          const shown = (b: SpanBar<CalendarItem>) => {
            const cells = Array.from({ length: b.span }, (_, k) => b.startCol + k);
            return cells.some((c) => overflow[c]) ? b.row < lines - 1 : b.row < lines;
          };
          return (
            <div key={start} className="relative grid grid-cols-7 border-b border-line last:border-b-0">
              {Array.from({ length: 7 }, (_, c) => {
                const d = addDays(start, c);
                const isToday = d === today;
                const inMonth = d.startsWith(month);
                return (
                  <div key={d} className={`flex flex-col items-center pt-1 ${c > 0 ? "border-l border-line" : ""} ${inMonth ? "" : "bg-panel/40"}`}>
                    <Link
                      href={dayHref(d)}
                      aria-current={isToday ? "date" : undefined}
                      className={`tabular grid h-6 min-w-6 place-items-center whitespace-nowrap rounded-full px-1.5 text-[12px] font-medium transition-colors duration-150 ${isToday ? "bg-accent text-accent-ink" : inMonth ? "text-fg hover:bg-panel-2" : "text-faint hover:bg-panel-2"}`}
                    >
                      {dayNumber(d) === 1 ? `${new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`))} 1` : dayNumber(d)}
                    </Link>
                  </div>
                );
              })}
              <div className="pointer-events-none absolute inset-x-0" style={{ top: HEAD_PX }}>
                {bars.filter(shown).map((b) => (
                  <MonthChip key={`${b.item.id}-${b.startCol}`} bar={b} color={colorOf(b.item)} timeZone={timeZone} now={now} onOpen={onOpen} />
                ))}
                {counts.map((count, c) => {
                  if (!overflow[c]) return null;
                  const visible = bars.filter((b) => shown(b) && c >= b.startCol && c < b.startCol + b.span).length;
                  return (
                    <Link
                      key={c}
                      href={dayHref(addDays(start, c))}
                      className="pointer-events-auto absolute truncate rounded px-2 text-[12px] font-medium leading-[20px] text-muted transition-colors duration-150 hover:bg-panel-2 hover:text-fg"
                      style={{ top: (lines - 1) * LINE_PX, left: `calc(${(c / 7) * 100}% + 2px)`, width: `calc(${100 / 7}% - 6px)` }}
                    >
                      {count - visible} more
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthChip({ bar, color, timeZone, now, onOpen }: { bar: SpanBar<CalendarItem>; color: string; timeZone: string; now: Date; onOpen: GridCommon["onOpen"] }) {
  const { item } = bar;
  const style = { top: bar.row * LINE_PX, left: `calc(${(bar.startCol / 7) * 100}% + ${bar.continuesBefore ? 0 : 3}px)`, width: `calc(${(bar.span / 7) * 100}% - ${bar.continuesAfter ? 3 : 7}px)`, height: LINE_PX - 2 };
  const faded = item.done || new Date(item.end) <= now;

  if (isSpanning(item)) {
    return (
      <button
        type="button"
        onClick={(e) => onOpen(item, e.currentTarget)}
        className={`pointer-events-auto absolute truncate px-2 text-left text-[12px] font-medium leading-[20px] transition-[filter] duration-150 hover:brightness-110 ${bar.continuesBefore ? "" : "rounded-l-md"} ${bar.continuesAfter ? "" : "rounded-r-md"} ${faded ? "opacity-60" : ""}`}
        style={{ ...style, background: color, color: inkOn(color) }}
      >
        <EmojiText text={item.title} className={item.done ? "line-through" : ""} />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => onOpen(item, e.currentTarget)}
      className={`pointer-events-auto absolute flex items-center gap-1.5 truncate rounded-md px-2 text-left text-[12px] leading-[20px] transition-colors duration-150 hover:bg-panel-2 ${faded ? "opacity-60" : ""}`}
      style={style}
    >
      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: color }} />
      <span className="tabular shrink-0 text-muted">{shortTime(item.start, timeZone)}</span>
      <EmojiText text={item.title} className={`truncate font-medium ${item.done ? "line-through" : ""}`} />
    </button>
  );
}
