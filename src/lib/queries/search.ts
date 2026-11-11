import { desc, ilike, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import { items, journal, listEntries, opportunities, paths, tasks } from "@/db/schema";
import { likePattern } from "@/lib/actions";
import { itemSearchCondition } from "./library";

export type SearchKind = "link" | "note" | "task" | "opportunity" | "path" | "journal" | "list";

export interface SearchHit {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
}

const PER_KIND = 6;

/** One search box over everything you've saved. */
export async function searchEverything(rawQuery: string): Promise<SearchHit[]> {
  const q = rawQuery.trim().slice(0, 200);
  if (q.length < 2) return [];
  const p = likePattern(q);
  const db = await getDb();

  const [itemRows, taskRows, oppRows, pathRows, journalRows, entryRows] = await Promise.all([
    db
      .select({ id: items.id, kind: items.kind, title: items.title, url: items.url })
      .from(items)
      .where(itemSearchCondition(q))
      .orderBy(desc(items.updatedAt))
      .limit(PER_KIND * 2),
    db.select({ id: tasks.id, title: tasks.title, horizon: tasks.horizon }).from(tasks).where(or(ilike(tasks.title, p), ilike(tasks.description, p))).limit(PER_KIND),
    db
      .select({ id: opportunities.id, name: opportunities.name, type: opportunities.type })
      .from(opportunities)
      .where(or(ilike(opportunities.name, p), ilike(opportunities.notes, p), ilike(opportunities.type, p)))
      .limit(PER_KIND),
    db.select({ id: paths.id, name: paths.name, emoji: paths.emoji }).from(paths).where(or(ilike(paths.name, p), ilike(paths.bodyText, p))).limit(PER_KIND),
    db.select({ day: journal.day }).from(journal).where(ilike(journal.bodyText, p)).orderBy(desc(journal.day)).limit(PER_KIND),
    db
      .select({ id: listEntries.id, listId: listEntries.listId, title: listEntries.title, subtitle: listEntries.subtitle })
      .from(listEntries)
      .where(or(ilike(listEntries.title, p), ilike(listEntries.notes, p), ilike(listEntries.subtitle, p)))
      .limit(PER_KIND),
  ]);

  return [
    ...itemRows.map<SearchHit>((r) =>
      r.kind === "note"
        ? { kind: "note", id: r.id, title: r.title, subtitle: "Note", href: `/notes/${r.id}` }
        : { kind: "link", id: r.id, title: r.title, subtitle: r.url, href: `/library/${r.id}` },
    ),
    ...taskRows.map<SearchHit>((r) => ({ kind: "task", id: r.id, title: r.title, subtitle: `Task · ${r.horizon}`, href: `/tasks?view=${r.horizon}#task-${r.id}` })),
    ...oppRows.map<SearchHit>((r) => ({ kind: "opportunity", id: r.id, title: r.name, subtitle: r.type ?? "Opportunity", href: `/opportunities/${r.id}` })),
    ...pathRows.map<SearchHit>((r) => ({ kind: "path", id: r.id, title: `${r.emoji ? `${r.emoji} ` : ""}${r.name}`, subtitle: "Path", href: `/paths/${r.id}` })),
    ...journalRows.map<SearchHit>((r) => ({ kind: "journal", id: r.day, title: `Journal · ${r.day}`, subtitle: null, href: `/journal?day=${r.day}` })),
    ...entryRows.map<SearchHit>((r) => ({ kind: "list", id: r.id, title: r.title, subtitle: r.subtitle ?? "List entry", href: `/lists/${r.listId}#entry-${r.id}` })),
  ];
}
