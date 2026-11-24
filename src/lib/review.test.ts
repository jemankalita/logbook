import { describe, expect, it } from "vitest";
import { parseWeekParam, reviewKey, reviewPrompt, reviewStreak, weekLabel, weekRange, weekStartOf } from "./review";

describe("weekStartOf", () => {
  it("returns the Monday of the week for every weekday", () => {
    // 2026-11-23 is a Monday
    expect(weekStartOf("2026-11-23")).toBe("2026-11-23");
    expect(weekStartOf("2026-11-25")).toBe("2026-11-23");
    expect(weekStartOf("2026-11-28")).toBe("2026-11-23");
  });

  it("treats Sunday as the last day of the week, not the first", () => {
    expect(weekStartOf("2026-11-29")).toBe("2026-11-23");
  });

  it("crosses month and year boundaries", () => {
    expect(weekStartOf("2027-01-01")).toBe("2026-12-28");
  });
});

describe("weekRange", () => {
  it("gives the 7 days and the neighbouring weeks", () => {
    const r = weekRange("2026-11-23");
    expect(r.start).toBe("2026-11-23");
    expect(r.end).toBe("2026-11-29");
    expect(r.days).toHaveLength(7);
    expect(r.prev).toBe("2026-11-16");
    expect(r.next).toBe("2026-11-30");
    expect(r.nextEnd).toBe("2026-12-06");
  });
});

describe("parseWeekParam", () => {
  it("snaps any valid day to its Monday", () => {
    expect(parseWeekParam("2026-11-26", "2026-11-24")).toBe("2026-11-23");
  });

  it("falls back to this week for missing or malformed input", () => {
    expect(parseWeekParam(undefined, "2026-11-24")).toBe("2026-11-23");
    expect(parseWeekParam("not-a-date", "2026-11-24")).toBe("2026-11-23");
    expect(parseWeekParam("2026-13-45", "2026-11-24")).toBe("2026-11-23");
  });

  it("never goes past the current week", () => {
    expect(parseWeekParam("2027-03-01", "2026-11-24")).toBe("2026-11-23");
  });
});

describe("reviewKey and weekLabel", () => {
  it("namespaces the settings key by week", () => {
    expect(reviewKey("2026-11-23")).toBe("review:2026-11-23");
  });

  it("labels a week within one month and across months", () => {
    expect(weekLabel("2026-11-09")).toBe("Nov 9 – 15, 2026");
    expect(weekLabel("2026-11-23")).toBe("Nov 23 – 29, 2026");
    expect(weekLabel("2026-11-30")).toBe("Nov 30 – Dec 6, 2026");
  });
});

describe("reviewPrompt", () => {
  // 2026-11-23 Mon … 2026-11-29 Sun
  it("asks for last week's review early in the week if it was skipped", () => {
    expect(reviewPrompt("2026-11-24", new Set())).toEqual({ state: "due", week: "2026-11-16" });
  });

  it("is quiet mid-week once last week is reviewed", () => {
    expect(reviewPrompt("2026-11-25", new Set(["2026-11-16"]))).toEqual({ state: "upcoming", week: "2026-11-23" });
  });

  it("asks for this week's review from Friday", () => {
    expect(reviewPrompt("2026-11-27", new Set(["2026-11-16"]))).toEqual({ state: "due", week: "2026-11-23" });
    expect(reviewPrompt("2026-11-29", new Set(["2026-11-16"]))).toEqual({ state: "due", week: "2026-11-23" });
  });

  it("is done once this week is reviewed", () => {
    expect(reviewPrompt("2026-11-28", new Set(["2026-11-23"]))).toEqual({ state: "done", week: "2026-11-23" });
  });

  it("stops nagging about last week after Wednesday", () => {
    expect(reviewPrompt("2026-11-26", new Set())).toEqual({ state: "upcoming", week: "2026-11-23" });
  });
});

describe("reviewStreak", () => {
  const thisWeek = "2026-11-23";

  it("is 0 with no reviews", () => {
    expect(reviewStreak(new Set(), thisWeek)).toBe(0);
  });

  it("counts consecutive reviewed weeks ending last week", () => {
    expect(reviewStreak(new Set(["2026-11-16", "2026-11-09", "2026-11-02"]), thisWeek)).toBe(3);
  });

  it("includes this week once it's reviewed", () => {
    expect(reviewStreak(new Set(["2026-11-23", "2026-11-16"]), thisWeek)).toBe(2);
  });

  it("doesn't break just because this week isn't reviewed yet", () => {
    expect(reviewStreak(new Set(["2026-11-16"]), thisWeek)).toBe(1);
  });

  it("stops at the first missed week", () => {
    expect(reviewStreak(new Set(["2026-11-16", "2026-11-02"]), thisWeek)).toBe(1);
  });
});
