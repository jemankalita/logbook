import { describe, expect, it } from "vitest";
import { addDays, dayInTimezone, diffDays, weekday } from "./dates";
import { buildHeatmap, computeStreaks, levelFor, parseMode } from "./heatmap";

const empty = { attendedDays: new Set<string>(), tasksByDay: new Map<string, number>() };

describe("dates", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("computes weekday and day differences", () => {
    expect(weekday("2026-11-11")).toBe(3); // Wednesday
    expect(diffDays("2026-11-11", "2026-11-01")).toBe(10);
  });

  it("resolves 'today' in the owner's timezone, not UTC", () => {
    // 20:00 UTC on Nov 10 is already Nov 11 in India (UTC+5:30)
    const instant = new Date("2026-11-10T20:00:00Z");
    expect(dayInTimezone(instant, "Asia/Kolkata")).toBe("2026-11-11");
    expect(dayInTimezone(instant, "UTC")).toBe("2026-11-10");
  });
});

describe("parseMode", () => {
  it("falls back to attendance for unknown values", () => {
    expect(parseMode("tasks")).toBe("tasks");
    expect(parseMode("nonsense")).toBe("attendance");
    expect(parseMode(undefined)).toBe("attendance");
  });
});

describe("levelFor", () => {
  it("scales counts relative to the busiest day", () => {
    expect(levelFor(0, 8)).toBe(0);
    expect(levelFor(1, 8)).toBe(1);
    expect(levelFor(3, 8)).toBe(2);
    expect(levelFor(5, 8)).toBe(3);
    expect(levelFor(8, 8)).toBe(4);
  });
});

describe("buildHeatmap", () => {
  it("builds week columns starting on Sunday and ending today", () => {
    const end = "2026-11-11"; // Wednesday
    const { weeks } = buildHeatmap(end, "attendance", empty, 4);

    expect(weeks).toHaveLength(4);
    expect(weeks[0][0]?.day).toBe("2026-10-18"); // Sunday 3 weeks before Sun Nov 8
    expect(weekday(weeks[0][0]!.day)).toBe(0);
    const last = weeks[3];
    expect(last[3]?.day).toBe(end);
    expect(last[4]).toBeNull(); // future days are blank
  });

  it("shows attendance as a binary full-green square", () => {
    const input = { attendedDays: new Set(["2026-11-10"]), tasksByDay: new Map([["2026-11-09", 3]]) };
    const cells = buildHeatmap("2026-11-11", "attendance", input, 2).weeks.flat();

    expect(cells.find((c) => c?.day === "2026-11-10")?.level).toBe(4);
    expect(cells.find((c) => c?.day === "2026-11-09")?.level).toBe(0);
  });

  it("combined mode adds a check-in to the day's task count", () => {
    const input = { attendedDays: new Set(["2026-11-10"]), tasksByDay: new Map([["2026-11-10", 3]]) };
    const cell = buildHeatmap("2026-11-11", "combined", input, 2).weeks.flat().find((c) => c?.day === "2026-11-10");
    expect(cell?.count).toBe(4);
  });

  it("labels months in order without adjacent repeats", () => {
    // 53 weeks spans >12 months, so the current month can appear at both ends (like GitHub).
    const { months } = buildHeatmap("2026-11-11", "attendance", empty, 53);
    const labels = months.map((m) => m.label);
    for (let i = 1; i < labels.length; i++) expect(labels[i]).not.toBe(labels[i - 1]);
    for (let i = 1; i < months.length; i++) expect(months[i].column).toBeGreaterThan(months[i - 1].column);
    expect(labels.at(-1)).toBe("Nov");
  });
});

describe("computeStreaks", () => {
  const today = "2026-11-11";

  it("returns zeros with no activity", () => {
    expect(computeStreaks([], today)).toEqual({ current: 0, longest: 0, total: 0 });
  });

  it("does not break the streak just because today isn't checked in yet", () => {
    const days = [addDays(today, -1), addDays(today, -2), addDays(today, -3)];
    expect(computeStreaks(days, today).current).toBe(3);
  });

  it("counts today when present and finds the longest run", () => {
    const days = [today, addDays(today, -1), "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"];
    expect(computeStreaks(days, today)).toEqual({ current: 2, longest: 4, total: 6 });
  });

  it("resets the current streak after a missed day", () => {
    expect(computeStreaks([addDays(today, -2)], today).current).toBe(0);
  });

  it("ignores duplicates and future days", () => {
    expect(computeStreaks([today, today, addDays(today, 3)], today).total).toBe(1);
  });
});
