"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, monthGrid } from "@/lib/calendar/view";
import { addDays, diffDays, formatDay, type Day } from "@/lib/dates";
import { dayNumber } from "./format";

const LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

/** The little month in Google's sidebar: browse months freely, click a day to jump there. */
export function MiniMonth({ anchor, today, rangeFirst, rangeDays, hrefFor }: { anchor: Day; today: Day; rangeFirst: Day; rangeDays: number; hrefFor: (day: Day) => string }) {
  const [shown, setShown] = useState(anchor);
  const [prevAnchor, setPrevAnchor] = useState(anchor);
  if (prevAnchor !== anchor) {
    setPrevAnchor(anchor);
    setShown(anchor);
  }
  const { first, days } = monthGrid(shown);
  const month = shown.slice(0, 7);
  const inRange = (d: Day) => diffDays(d, rangeFirst) >= 0 && diffDays(d, rangeFirst) < rangeDays;

  return (
    <div className="select-none">
      <div className="mb-1 flex items-center justify-between pl-2">
        <p className="text-sm font-medium">{formatDay(shown, { month: "long", year: "numeric" })}</p>
        <div className="flex">
          <button type="button" onClick={() => setShown(addMonths(shown, -1))} aria-label="Previous month" className="grid size-7 place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-panel-2 hover:text-fg">
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button type="button" onClick={() => setShown(addMonths(shown, 1))} aria-label="Next month" className="grid size-7 place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-panel-2 hover:text-fg">
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] font-medium text-faint">
        {LETTERS.map((l, i) => (
          <span key={i} className="py-1">
            {l}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {Array.from({ length: days }, (_, i) => {
          const d = addDays(first, i);
          const isToday = d === today;
          const selected = inRange(d) && rangeDays < 28;
          return (
            <Link
              key={d}
              href={hrefFor(d)}
              aria-label={formatDay(d, { weekday: "long", month: "long", day: "numeric" })}
              aria-current={isToday ? "date" : undefined}
              className={`tabular mx-auto grid size-7 place-items-center rounded-full text-[11px] transition-colors duration-150 ${
                isToday ? "bg-accent font-semibold text-accent-ink" : selected ? "bg-accent/20 font-medium text-fg" : d.startsWith(month) ? "text-fg hover:bg-panel-2" : "text-faint hover:bg-panel-2"
              }`}
            >
              {dayNumber(d)}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
