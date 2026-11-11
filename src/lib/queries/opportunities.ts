import { and, asc, eq, gte, isNotNull, isNull, lte, ne, notInArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { items, opportunities, tasks } from "@/db/schema";
import { addDays, diffDays, type Day } from "@/lib/dates";

export type Opportunity = typeof opportunities.$inferSelect;
export { OPP_STATUSES, OPP_STATUS_LABELS, OPP_TYPES, type OppStatus } from "@/lib/opportunity-meta";
import type { OppStatus } from "@/lib/opportunity-meta";

/** Statuses whose deadline no longer matters. */
const FINISHED: OppStatus[] = ["submitted", "result", "closed"];

export async function listOpportunities(): Promise<Opportunity[]> {
  const db = await getDb();
  return db.select().from(opportunities).orderBy(sql`${opportunities.deadline} asc nulls last`, asc(opportunities.createdAt));
}

export async function getOpportunity(id: string): Promise<Opportunity | null> {
  const db = await getDb();
  const [row] = await db.select().from(opportunities).where(eq(opportunities.id, id)).limit(1);
  return row ?? null;
}

export interface Deadline {
  kind: "opportunity" | "task" | "link";
  id: string;
  title: string;
  date: Day;
  daysLeft: number;
  href: string;
  detail: string | null;
}

/** Everything with a date coming up (or a little overdue): opportunities, tasks and "do by" links. */
export async function upcomingDeadlines(today: Day, withinDays = 30, overdueDays = 7): Promise<Deadline[]> {
  const db = await getDb();
  const from = addDays(today, -overdueDays);
  const to = addDays(today, withinDays);
  const [opps, taskRows, linkRows] = await Promise.all([
    db
      .select({ id: opportunities.id, name: opportunities.name, deadline: opportunities.deadline, nextAction: opportunities.nextAction, type: opportunities.type })
      .from(opportunities)
      .where(and(isNotNull(opportunities.deadline), gte(opportunities.deadline, from), lte(opportunities.deadline, to), notInArray(opportunities.status, FINISHED))),
    db
      .select({ id: tasks.id, title: tasks.title, dueDate: tasks.dueDate, horizon: tasks.horizon })
      .from(tasks)
      .where(and(isNull(tasks.recurrence), ne(tasks.status, "done"), gte(tasks.dueDate, from), lte(tasks.dueDate, to), sql`${tasks.dueDate} > ${today}`)),
    db
      .select({ id: items.id, title: items.title, deadline: items.deadline })
      .from(items)
      .where(and(isNotNull(items.deadline), ne(items.status, "done"), gte(items.deadline, from), lte(items.deadline, to))),
  ]);
  const list: Deadline[] = [
    ...opps.map((o) => ({ kind: "opportunity" as const, id: o.id, title: o.name, date: o.deadline as Day, href: `/opportunities/${o.id}`, detail: o.nextAction ?? o.type })),
    ...taskRows.map((t) => ({ kind: "task" as const, id: t.id, title: t.title, date: t.dueDate as Day, href: `/tasks?view=upcoming#task-${t.id}`, detail: null })),
    ...linkRows.map((l) => ({ kind: "link" as const, id: l.id, title: l.title, date: l.deadline as Day, href: `/library/${l.id}`, detail: null })),
  ].map((d) => ({ ...d, daysLeft: diffDays(d.date, today) }));
  return list.sort((a, b) => a.date.localeCompare(b.date));
}

export function countdownLabel(daysLeft: number): string {
  if (daysLeft < 0) return `${-daysLeft}d overdue`;
  if (daysLeft === 0) return "today";
  if (daysLeft === 1) return "tomorrow";
  return `in ${daysLeft}d`;
}
