import { addDays, diffDays, weekday, type Day } from "./dates";

export const HEATMAP_MODES = ["attendance", "tasks", "combined"] as const;
export type HeatmapMode = (typeof HEATMAP_MODES)[number];

export function parseMode(value: string | undefined | null): HeatmapMode {
  return HEATMAP_MODES.includes(value as HeatmapMode) ? (value as HeatmapMode) : "attendance";
}

export type Level = 0 | 1 | 2 | 3 | 4;

export interface HeatmapCell {
  day: Day;
  count: number;
  level: Level;
  attended: boolean;
  tasksDone: number;
}

export interface HeatmapData {
  /** columns of 7 cells (Sun → Sat); null = outside the range */
  weeks: (HeatmapCell | null)[][];
  months: { label: string; column: number }[];
}

export interface ActivityInput {
  attendedDays: ReadonlySet<Day>;
  tasksByDay: ReadonlyMap<Day, number>;
}

/** Map a raw count to a 0–4 intensity relative to the busiest day. */
export function levelFor(count: number, max: number): Level {
  if (count <= 0 || max <= 0) return 0;
  const ratio = count / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

function countFor(mode: HeatmapMode, attended: boolean, tasksDone: number): number {
  switch (mode) {
    case "attendance":
      return attended ? 1 : 0;
    case "tasks":
      return tasksDone;
    case "combined":
      return (attended ? 1 : 0) + tasksDone;
  }
}

function cellLevel(mode: HeatmapMode, count: number, max: number): Level {
  // Attendance is binary: a check-in is always a full green square.
  if (mode === "attendance") return count > 0 ? 4 : 0;
  return levelFor(count, max);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * GitHub-style grid ending at `end` (inclusive), `weekCount` columns wide.
 * The first column starts on the Sunday so rows line up by weekday.
 */
export function buildHeatmap(end: Day, mode: HeatmapMode, input: ActivityInput, weekCount = 53): HeatmapData {
  const lastSunday = addDays(end, -weekday(end));
  const start = addDays(lastSunday, -(weekCount - 1) * 7);

  const raw: { day: Day; attended: boolean; tasksDone: number; count: number }[] = [];
  for (let d = start; diffDays(end, d) >= 0; d = addDays(d, 1)) {
    const attended = input.attendedDays.has(d);
    const tasksDone = input.tasksByDay.get(d) ?? 0;
    raw.push({ day: d, attended, tasksDone, count: countFor(mode, attended, tasksDone) });
  }
  const max = raw.reduce((m, c) => Math.max(m, c.count), 0);

  const weeks: (HeatmapCell | null)[][] = [];
  const months: { label: string; column: number }[] = [];
  let lastMonth = -1;

  for (let w = 0; w < weekCount; w++) {
    const column: (HeatmapCell | null)[] = [];
    for (let i = 0; i < 7; i++) {
      const c = raw[w * 7 + i];
      column.push(c ? { ...c, level: cellLevel(mode, c.count, max) } : null);
    }
    const firstDay = column[0]?.day;
    if (firstDay) {
      const month = Number(firstDay.slice(5, 7)) - 1;
      if (month !== lastMonth) {
        months.push({ label: MONTHS[month], column: w });
        lastMonth = month;
      }
    }
    weeks.push(column);
  }
  // Drop a leading month label that would be squashed against the next one.
  if (months.length > 1 && months[1].column - months[0].column < 2) months.shift();

  return { weeks, months };
}

export interface Streaks {
  current: number;
  longest: number;
  total: number;
}

/**
 * Streaks over a set of active days. Today not being active yet does not
 * break the current streak — it counts back from yesterday.
 */
export function computeStreaks(activeDays: Iterable<Day>, todayDay: Day): Streaks {
  const days = [...new Set(activeDays)].filter((d) => diffDays(todayDay, d) >= 0).sort();
  if (days.length === 0) return { current: 0, longest: 0, total: 0 };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = diffDays(days[i], days[i - 1]) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const set = new Set(days);
  let cursor = set.has(todayDay) ? todayDay : addDays(todayDay, -1);
  let current = 0;
  while (set.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  return { current, longest, total: days.length };
}
