import { addDays, dayInTimezone, diffDays, type Day } from "@/lib/dates";
import { zonedToUtc } from "@/lib/time";
import type { CalendarItem } from "./items";

/**
 * Geometry for the Google-style grids. Pure functions so the tricky parts — overlapping events,
 * bars spanning several days, timezones — are unit-tested rather than eyeballed.
 */

const DAY_MS = 86_400_000;
/** Short events still get this much room, and are laid out as if they were this long. */
export const MIN_EVENT_MINUTES = 20;

type Timed = Pick<CalendarItem, "id" | "start" | "end" | "allDay">;
type Spannable = Timed & Pick<CalendarItem, "startDay" | "endDay" | "title">;

/** All-day items, and timed ones lasting a day or more, go in the strip above the hours (as in Google). */
export function isSpanning(item: Timed): boolean {
  return item.allDay || Date.parse(item.end) - Date.parse(item.start) >= DAY_MS;
}

/** First day and exclusive end day an item touches, in `timeZone`. */
export function coveredDays(item: Spannable, timeZone: string): { start: Day; end: Day } {
  if (item.allDay && item.startDay) {
    const end = item.endDay && diffDays(item.endDay, item.startDay) > 0 ? item.endDay : addDays(item.startDay, 1);
    return { start: item.startDay, end };
  }
  const start = dayInTimezone(new Date(item.start), timeZone);
  const lastInstant = Math.max(Date.parse(item.start), Date.parse(item.end) - 1);
  return { start, end: addDays(dayInTimezone(new Date(lastInstant), timeZone), 1) };
}

export interface TimedSegment<T extends Timed> {
  item: T;
  /** minutes after local midnight, clipped to this day */
  startMin: number;
  endMin: number;
  /** column within its overlap cluster, and how many columns the cluster has */
  col: number;
  cols: number;
  /** the event started on an earlier day / runs past midnight */
  continuesBefore: boolean;
  continuesAfter: boolean;
}

/** Position the timed (non-spanning) items that fall on `day`: side-by-side columns where they overlap. */
export function layoutTimedDay<T extends Timed>(items: readonly T[], day: Day, timeZone: string): TimedSegment<T>[] {
  const dayStart = zonedToUtc(day, "00:00", timeZone).getTime();
  const dayEnd = zonedToUtc(addDays(day, 1), "00:00", timeZone).getTime();
  const segments: TimedSegment<T>[] = [];

  for (const item of items) {
    if (isSpanning(item)) continue;
    const start = Date.parse(item.start);
    const end = Math.max(start, Date.parse(item.end));
    const touches = start < dayEnd && (end > dayStart || (end === start && start >= dayStart));
    if (!touches) continue;
    const s = Math.max(start, dayStart);
    const e = Math.min(end, dayEnd);
    segments.push({
      item,
      startMin: (s - dayStart) / 60_000,
      endMin: (e - dayStart) / 60_000,
      col: 0,
      cols: 1,
      continuesBefore: start < dayStart,
      continuesAfter: end > dayEnd,
    });
  }

  segments.sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin || a.item.id.localeCompare(b.item.id));

  const visualEnd = (s: TimedSegment<T>) => Math.max(s.endMin, s.startMin + MIN_EVENT_MINUTES);
  let cluster: TimedSegment<T>[] = [];
  let columnEnds: number[] = [];
  let clusterEnd = -Infinity;
  const close = () => {
    for (const s of cluster) s.cols = columnEnds.length;
    cluster = [];
    columnEnds = [];
    clusterEnd = -Infinity;
  };

  for (const seg of segments) {
    if (seg.startMin >= clusterEnd) close();
    let col = columnEnds.findIndex((end) => end <= seg.startMin);
    if (col === -1) col = columnEnds.push(0) - 1;
    columnEnds[col] = visualEnd(seg);
    seg.col = col;
    cluster.push(seg);
    clusterEnd = Math.max(clusterEnd, visualEnd(seg));
  }
  close();
  return segments;
}

export interface SpanBar<T extends Spannable> {
  item: T;
  /** 0-based column within the visible range, and how many columns the bar covers */
  startCol: number;
  span: number;
  row: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
}

/**
 * Stack items as horizontal bars over `days` columns starting at `first` (the week view's all-day
 * strip, or one row of the month grid). Multi-day bars claim the top rows, like Google.
 */
export function layoutSpans<T extends Spannable>(items: readonly T[], first: Day, days: number, timeZone: string): SpanBar<T>[] {
  const bars: SpanBar<T>[] = [];
  for (const item of items) {
    const { start, end } = coveredDays(item, timeZone);
    const from = diffDays(start, first);
    const to = diffDays(end, first);
    const startCol = Math.max(0, from);
    const endCol = Math.min(days, to);
    if (endCol <= startCol) continue;
    bars.push({ item, startCol, span: endCol - startCol, row: 0, continuesBefore: from < 0, continuesAfter: to > days });
  }

  const rank = (b: SpanBar<T>) => (isSpanning(b.item) ? 0 : 1);
  bars.sort((a, b) => a.startCol - b.startCol || rank(a) - rank(b) || b.span - a.span || a.item.start.localeCompare(b.item.start) || a.item.title.localeCompare(b.item.title));

  const rowEnds: number[] = [];
  for (const bar of bars) {
    let row = rowEnds.findIndex((end) => end <= bar.startCol);
    if (row === -1) row = rowEnds.push(0) - 1;
    rowEnds[row] = bar.startCol + bar.span;
    bar.row = row;
  }
  return bars;
}

/** For month cells: how many bars cover each column (to compute "+N more"). */
export function countPerColumn(bars: readonly { startCol: number; span: number }[], days: number): number[] {
  const counts = Array.from({ length: days }, () => 0);
  for (const b of bars) for (let c = b.startCol; c < b.startCol + b.span; c++) counts[c]++;
  return counts;
}
