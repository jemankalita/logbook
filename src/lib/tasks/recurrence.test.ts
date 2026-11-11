import { describe, expect, it } from "vitest";
import { formatDuration, startOfWeek, timeInZone, zonedToUtc } from "@/lib/time";
import { describeRecurrence, habitStreak, occursOn, parseRecurrence } from "./recurrence";

// 2026-03-02 is a Monday.
const MON = "2026-03-02";

describe("recurrence rules", () => {
  it("parses only known shapes", () => {
    expect(parseRecurrence("daily")).toBe("daily");
    expect(parseRecurrence("days:5,1,1")).toBe("days:1,5");
    expect(parseRecurrence("days:7")).toBeNull();
    expect(parseRecurrence("hourly")).toBeNull();
    expect(parseRecurrence(null)).toBeNull();
  });

  it("schedules weekdays, weekly and custom days", () => {
    expect(occursOn("weekdays", MON, "2026-03-06")).toBe(true); // Fri
    expect(occursOn("weekdays", MON, "2026-03-07")).toBe(false); // Sat
    expect(occursOn("weekly", MON, "2026-03-09")).toBe(true);
    expect(occursOn("weekly", MON, "2026-03-10")).toBe(false);
    expect(occursOn("days:0,6", MON, "2026-03-08")).toBe(true); // Sun
    expect(occursOn("daily", MON, "2026-03-01")).toBe(false); // before it started
  });

  it("describes rules for humans", () => {
    expect(describeRecurrence("weekdays")).toBe("Weekdays");
    expect(describeRecurrence("days:1,3,5")).toBe("Mon, Wed, Fri");
  });
});

describe("habitStreak", () => {
  it("counts back over scheduled days only", () => {
    // Weekdays habit, done Mon–Fri of week 1 and Mon of week 2; today = Tue week 2 (not yet done).
    const done = new Set(["2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05", "2026-03-06", "2026-03-09"]);
    expect(habitStreak("weekdays", MON, done, "2026-03-10")).toBe(6);
  });

  it("breaks on a missed scheduled day", () => {
    const done = new Set(["2026-03-02", "2026-03-04"]);
    expect(habitStreak("daily", MON, done, "2026-03-04")).toBe(1);
  });

  it("is zero when nothing is done", () => {
    expect(habitStreak("daily", MON, new Set(), "2026-03-05")).toBe(0);
  });
});

describe("timezone helpers", () => {
  it("converts Kolkata wall-clock time to UTC and back", () => {
    const instant = zonedToUtc("2026-03-10", "09:30", "Asia/Kolkata");
    expect(instant.toISOString()).toBe("2026-03-10T04:00:00.000Z");
    expect(timeInZone(instant, "Asia/Kolkata")).toBe("09:30");
  });

  it("handles a DST zone", () => {
    expect(zonedToUtc("2026-07-01", "12:00", "America/New_York").toISOString()).toBe("2026-07-01T16:00:00.000Z");
    expect(zonedToUtc("2026-01-15", "12:00", "America/New_York").toISOString()).toBe("2026-01-15T17:00:00.000Z");
  });

  it("finds the Monday of a week", () => {
    expect(startOfWeek("2026-03-08")).toBe(MON); // Sunday → previous Monday
    expect(startOfWeek(MON)).toBe(MON);
  });

  it("formats durations", () => {
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(120)).toBe("2h");
    expect(formatDuration(95)).toBe("1h 35m");
  });
});
