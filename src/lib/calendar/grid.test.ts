import { describe, expect, test } from "vitest";
import { inkOn } from "./items";
import { countPerColumn, coveredDays, isSpanning, layoutSpans, layoutTimedDay } from "./layout";
import { addMonths, monthGrid, parseAnchor, parseView, spanTitle, sundayOf, viewRange } from "./view";

const TZ = "Asia/Kolkata"; // UTC+5:30, no DST

/** A timed item from local "HH:MM" on `day` in Kolkata. */
function timed(id: string, day: string, from: string, to: string, toDay = day) {
  const iso = (d: string, t: string) => new Date(`${d}T${t}:00+05:30`).toISOString();
  return { id, title: id, start: iso(day, from), end: iso(toDay, to), allDay: false };
}
function allDay(id: string, startDay: string, endDay: string) {
  return { id, title: id, start: `${startDay}T00:00:00.000Z`, end: `${endDay}T00:00:00.000Z`, allDay: true, startDay, endDay };
}

describe("view ranges", () => {
  test("unknown values fall back to week / the given day", () => {
    expect(parseView("year")).toBe("week");
    expect(parseView("month")).toBe("month");
    expect(parseAnchor("2026-13-40", "2026-11-16")).toBe("2026-11-16");
    expect(parseAnchor("2026-02-03", "2026-11-16")).toBe("2026-02-03");
  });

  test("weeks start on Sunday", () => {
    expect(sundayOf("2026-11-16")).toBe("2026-11-15"); // a Monday
    expect(sundayOf("2026-11-15")).toBe("2026-11-15");
    const r = viewRange("week", "2026-11-18");
    expect([r.first, r.days, r.prev, r.next]).toEqual(["2026-11-15", 7, "2026-11-11", "2026-11-25"]);
  });

  test("month grid covers whole weeks of the month", () => {
    expect(monthGrid("2026-11-16")).toEqual({ first: "2026-11-01", days: 35 }); // Nov 1 2026 is a Sunday
    expect(monthGrid("2026-08-10")).toEqual({ first: "2026-07-26", days: 42 }); // Aug 2026 needs 6 rows
    expect(monthGrid("2026-02-01")).toEqual({ first: "2026-02-01", days: 28 }); // Feb 2026: exactly 4 rows
  });

  test("month steps clamp to the shorter month", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-15");
  });

  test("titles read like Google's", () => {
    expect(spanTitle("2026-11-15", "2026-11-21")).toBe("November 2026");
    expect(spanTitle("2026-11-29", "2026-12-05")).toBe("Nov – Dec 2026");
    expect(spanTitle("2026-12-27", "2027-01-02")).toBe("Dec 2026 – Jan 2027");
    expect(viewRange("day", "2026-11-16").title).toBe("November 16, 2026");
  });
});

describe("layoutTimedDay", () => {
  test("non-overlapping events each get the full width", () => {
    const segs = layoutTimedDay([timed("a", "2026-11-16", "09:00", "10:00"), timed("b", "2026-11-16", "10:00", "11:00")], "2026-11-16", TZ);
    expect(segs.map((s) => [s.item.id, s.startMin, s.endMin, s.col, s.cols])).toEqual([
      ["a", 540, 600, 0, 1],
      ["b", 600, 660, 0, 1],
    ]);
  });

  test("overlapping events share the width in columns", () => {
    const segs = layoutTimedDay(
      [timed("long", "2026-11-16", "09:00", "12:00"), timed("x", "2026-11-16", "09:30", "10:00"), timed("y", "2026-11-16", "10:30", "11:00"), timed("later", "2026-11-16", "13:00", "14:00")],
      "2026-11-16",
      TZ,
    );
    const by = Object.fromEntries(segs.map((s) => [s.item.id, [s.col, s.cols]]));
    expect(by).toEqual({ long: [0, 2], x: [1, 2], y: [1, 2], later: [0, 1] });
  });

  test("an event crossing midnight is clipped on both days", () => {
    const e = timed("late", "2026-11-16", "23:00", "01:00", "2026-11-17");
    const [mon] = layoutTimedDay([e], "2026-11-16", TZ);
    const [tue] = layoutTimedDay([e], "2026-11-17", TZ);
    expect([mon.startMin, mon.endMin, mon.continuesAfter]).toEqual([1380, 1440, true]);
    expect([tue.startMin, tue.endMin, tue.continuesBefore]).toEqual([0, 60, true]);
  });

  test("all-day and 24h+ events are left for the all-day strip", () => {
    const long = timed("trip", "2026-11-16", "08:00", "09:00", "2026-11-18");
    expect(isSpanning(long)).toBe(true);
    expect(layoutTimedDay([long, allDay("hol", "2026-11-16", "2026-11-17")], "2026-11-16", TZ)).toEqual([]);
  });
});

describe("layoutSpans", () => {
  test("multi-day bars are clipped to the range and stacked", () => {
    const bars = layoutSpans([allDay("conf", "2026-11-13", "2026-11-18"), allDay("due", "2026-11-16", "2026-11-17"), allDay("trip", "2026-11-20", "2026-11-25")], "2026-11-15", 7, TZ);
    const by = Object.fromEntries(bars.map((b) => [b.item.id, [b.startCol, b.span, b.row, b.continuesBefore, b.continuesAfter]]));
    expect(by).toEqual({
      conf: [0, 3, 0, true, false],
      due: [1, 1, 1, false, false],
      trip: [5, 2, 0, false, true],
    });
    expect(countPerColumn(bars, 7)).toEqual([1, 2, 1, 0, 0, 1, 1]);
  });

  test("timed items cover the local day they happen on", () => {
    expect(coveredDays(timed("e", "2026-11-16", "00:30", "01:00"), TZ)).toEqual({ start: "2026-11-16", end: "2026-11-17" });
    // ends exactly at midnight → does not spill into the next day
    expect(coveredDays(timed("e", "2026-11-16", "22:00", "00:00", "2026-11-17"), TZ)).toEqual({ start: "2026-11-16", end: "2026-11-17" });
  });
});

describe("inkOn", () => {
  test("picks readable text for Google's palette", () => {
    expect(inkOn("#3f51b5")).toBe("#ffffff");
    expect(inkOn("#f6bf26")).toBe("#1f1f1f");
  });
});
