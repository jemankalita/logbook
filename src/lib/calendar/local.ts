import { and, gt, gte, isNotNull, isNull, lt, lte, ne } from "drizzle-orm";
import { getDb } from "@/db/client";
import { items, opportunities, tasks, timeBlocks } from "@/db/schema";
import { addDays, dayInTimezone, type Day } from "@/lib/dates";
import { startOfWeek, zonedToUtc } from "@/lib/time";
import { allDayItem, LOCAL_SOURCES, type CalendarItem, type CalendarSource } from "./items";

/**
 * Logbook's own dated things, shown on the calendar like Google shows Tasks:
 * task due dates, opportunity / "do by" deadlines, and Time Table blocks.
 */
export async function getLocalCalendar(first: Day, days: number, timeZone: string): Promise<{ sources: CalendarSource[]; items: CalendarItem[] }> {
  const last = addDays(first, days - 1);
  const rangeStart = zonedToUtc(first, "00:00", timeZone);
  const rangeEnd = zonedToUtc(addDays(first, days), "00:00", timeZone);
  const db = await getDb();

  const [taskRows, oppRows, linkRows, blockRows] = await Promise.all([
    db
      .select({ id: tasks.id, title: tasks.title, dueDate: tasks.dueDate, status: tasks.status, area: tasks.area })
      .from(tasks)
      .where(and(isNull(tasks.recurrence), isNotNull(tasks.dueDate), gte(tasks.dueDate, first), lte(tasks.dueDate, last))),
    db
      .select({ id: opportunities.id, name: opportunities.name, deadline: opportunities.deadline, status: opportunities.status, nextAction: opportunities.nextAction })
      .from(opportunities)
      .where(and(isNotNull(opportunities.deadline), gte(opportunities.deadline, first), lte(opportunities.deadline, last), ne(opportunities.status, "closed"))),
    db
      .select({ id: items.id, title: items.title, deadline: items.deadline, status: items.status })
      .from(items)
      .where(and(isNotNull(items.deadline), gte(items.deadline, first), lte(items.deadline, last))),
    db
      .select({ id: timeBlocks.id, title: timeBlocks.title, area: timeBlocks.area, startsAt: timeBlocks.startsAt, endsAt: timeBlocks.endsAt, done: timeBlocks.done, notes: timeBlocks.notes })
      .from(timeBlocks)
      .where(and(lt(timeBlocks.startsAt, rangeEnd), gt(timeBlocks.endsAt, rangeStart))),
  ]);

  const list: CalendarItem[] = [
    ...taskRows.map((t) =>
      allDayItem(
        { id: `task:${t.id}`, sourceId: LOCAL_SOURCES.tasks.id, title: t.title, href: `/tasks?view=upcoming#task-${t.id}`, done: t.status === "done", detail: t.area ?? undefined },
        t.dueDate as Day,
        addDays(t.dueDate as Day, 1),
      ),
    ),
    ...oppRows.map((o) =>
      allDayItem(
        { id: `opp:${o.id}`, sourceId: LOCAL_SOURCES.deadlines.id, title: o.name, href: `/opportunities/${o.id}`, done: o.status === "submitted" || o.status === "result", detail: o.nextAction ? `Next: ${o.nextAction}` : undefined },
        o.deadline as Day,
        addDays(o.deadline as Day, 1),
      ),
    ),
    ...linkRows.map((l) =>
      allDayItem(
        { id: `link:${l.id}`, sourceId: LOCAL_SOURCES.deadlines.id, title: l.title, href: `/library/${l.id}`, done: l.status === "done", detail: "Saved link — do by" },
        l.deadline as Day,
        addDays(l.deadline as Day, 1),
      ),
    ),
    ...blockRows.map((b) => ({
      id: `block:${b.id}`,
      sourceId: LOCAL_SOURCES.timetable.id,
      title: b.title,
      start: b.startsAt.toISOString(),
      end: b.endsAt.toISOString(),
      allDay: false,
      done: b.done,
      href: `/timetable?week=${startOfWeek(dayInTimezone(b.startsAt, timeZone))}`,
      detail: [b.area, b.notes].filter(Boolean).join(" · ") || undefined,
    })),
  ];

  const sources = [LOCAL_SOURCES.tasks, LOCAL_SOURCES.deadlines, LOCAL_SOURCES.timetable].map((s) => ({ ...s, ok: true }));
  return { sources, items: list };
}
