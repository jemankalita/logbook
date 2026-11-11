import { describe, expect, it } from "vitest";
import { buildAgenda, formatTimeRange, isHappeningNow } from "./agenda";
import { getFeedUrls } from "./feeds";
import { parseCalendar } from "./parse";

const TZ = "Asia/Kolkata";

/** Synthetic feed shaped like Google's secret iCal export. */
const ICS = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Google Inc//Google Calendar 70.9054//EN",
  "X-WR-CALNAME:College",
  "BEGIN:VTIMEZONE",
  "TZID:Asia/Kolkata",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0530",
  "TZOFFSETTO:+0530",
  "TZNAME:IST",
  "DTSTART:19700101T000000",
  "END:STANDARD",
  "END:VTIMEZONE",
  // Weekly Mon 09:00–10:00 IST lecture, skipping Nov 16
  "BEGIN:VEVENT",
  "UID:lecture@test",
  "SUMMARY:DSA Lecture",
  "LOCATION:SJT 501",
  "DTSTART;TZID=Asia/Kolkata:20261102T090000",
  "DTEND;TZID=Asia/Kolkata:20261102T100000",
  "RRULE:FREQ=WEEKLY;BYDAY=MO",
  "EXDATE;TZID=Asia/Kolkata:20261116T090000",
  "END:VEVENT",
  // The Nov 9 lecture moved to 14:00
  "BEGIN:VEVENT",
  "UID:lecture@test",
  "RECURRENCE-ID;TZID=Asia/Kolkata:20261109T090000",
  "SUMMARY:DSA Lecture (moved)",
  "DTSTART;TZID=Asia/Kolkata:20261109T140000",
  "DTEND;TZID=Asia/Kolkata:20261109T150000",
  "END:VEVENT",
  // Multi-day all-day event Nov 10–11 (DTEND exclusive)
  "BEGIN:VEVENT",
  "UID:fest@test",
  "SUMMARY:Hackathon",
  "DTSTART;VALUE=DATE:20261110",
  "DTEND;VALUE=DATE:20261112",
  "END:VEVENT",
  // Cancelled
  "BEGIN:VEVENT",
  "UID:cancelled@test",
  "SUMMARY:Cancelled meeting",
  "STATUS:CANCELLED",
  "DTSTART:20261110T050000Z",
  "DTEND:20261110T060000Z",
  "END:VEVENT",
  // Far outside the range
  "BEGIN:VEVENT",
  "UID:old@test",
  "SUMMARY:Old event",
  "DTSTART:20250101T050000Z",
  "DTEND:20250101T060000Z",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

const range = { start: new Date("2026-11-08T18:30:00Z"), end: new Date("2026-11-23T18:30:00Z") }; // Nov 9 → Nov 24 IST

describe("parseCalendar", () => {
  const { name, events } = parseCalendar(ICS, range, 0, "Calendar 1");
  const titles = events.map((e) => e.title);

  it("reads the calendar name", () => {
    expect(name).toBe("College");
    expect(events.every((e) => e.calendarName === "College")).toBe(true);
  });

  it("expands recurrences inside the range, applying moves and EXDATEs", () => {
    const lectures = events.filter((e) => e.title.startsWith("DSA Lecture"));
    expect(lectures.map((e) => e.start)).toEqual([
      "2026-11-09T08:30:00.000Z", // moved to 14:00 IST
      "2026-11-23T03:30:00.000Z", // 09:00 IST; Nov 16 skipped
    ]);
    expect(lectures[0].title).toBe("DSA Lecture (moved)");
    expect(lectures[1].location).toBe("SJT 501");
  });

  it("drops cancelled and out-of-range events", () => {
    expect(titles).not.toContain("Cancelled meeting");
    expect(titles).not.toContain("Old event");
  });

  it("keeps all-day events as plain days", () => {
    const fest = events.find((e) => e.title === "Hackathon");
    expect(fest).toMatchObject({ allDay: true, startDay: "2026-11-10", endDay: "2026-11-12" });
  });

  it("falls back to a default name and survives an empty calendar", () => {
    const empty = parseCalendar("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR", range, 2, "Calendar 3");
    expect(empty).toEqual({ name: null, events: [] });
  });
});

describe("buildAgenda", () => {
  const { events } = parseCalendar(ICS, range, 0, "Calendar 1");
  const agenda = buildAgenda(events, "2026-11-09", 3, TZ);

  it("buckets timed events by their local start day", () => {
    expect(agenda.map((d) => d.day)).toEqual(["2026-11-09", "2026-11-10", "2026-11-11"]);
    expect(agenda[0].timed.map((e) => e.title)).toEqual(["DSA Lecture (moved)"]);
  });

  it("spreads multi-day all-day events over each covered day, end-exclusive", () => {
    expect(agenda[0].allDay).toHaveLength(0);
    expect(agenda[1].allDay.map((e) => e.title)).toEqual(["Hackathon"]);
    expect(agenda[2].allDay.map((e) => e.title)).toEqual(["Hackathon"]);
  });
});

describe("getFeedUrls", () => {
  it("splits on commas/whitespace and keeps only https URLs", () => {
    const raw = " https://calendar.google.com/a/basic.ics,\nhttp://insecure.example/x.ics  not-a-url https://calendar.google.com/b/basic.ics ";
    expect(getFeedUrls(raw)).toEqual(["https://calendar.google.com/a/basic.ics", "https://calendar.google.com/b/basic.ics"]);
    expect(getFeedUrls("")).toEqual([]);
  });
});

describe("formatting", () => {
  const { events } = parseCalendar(ICS, range, 0, "Calendar 1");
  const moved = events.find((e) => e.title === "DSA Lecture (moved)")!;

  it("formats times in the owner's timezone", () => {
    expect(formatTimeRange(moved, TZ)).toBe("2:00 PM – 3:00 PM");
  });

  it("knows when an event is happening now", () => {
    expect(isHappeningNow(moved, new Date("2026-11-09T09:00:00Z"))).toBe(true);
    expect(isHappeningNow(moved, new Date("2026-11-09T10:00:00Z"))).toBe(false);
  });
});
