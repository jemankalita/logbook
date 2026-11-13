import Link from "next/link";
import { asc, count, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { listEntries, lists } from "@/db/schema";
import { cls } from "@/components/cls";
import { KIND_COPY } from "@/components/lists/kind-copy";
import { NewListForm } from "@/components/lists/list-ui";
import { PageHeader } from "@/components/page-ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Lists · Logbook" };

export default async function ListsPage() {
  const db = await getDb();
  const rows = await db
    .select({
      id: lists.id,
      name: lists.name,
      emoji: lists.emoji,
      kind: lists.kind,
      total: count(listEntries.id),
      done: sql<number>`count(*) filter (where ${listEntries.status} = 'done')`.mapWith(Number),
    })
    .from(lists)
    .leftJoin(listEntries, eq(listEntries.listId, lists.id))
    .groupBy(lists.id)
    .orderBy(asc(lists.position), asc(lists.name));

  return (
    <div className="rise mx-auto flex max-w-4xl flex-col gap-5">
      <PageHeader eyebrow="Knowledge" title="Lists" description="Watchlists, people to reach out to, and anything else worth keeping track of." />
      {rows.length === 0 ? <p className="text-sm text-muted">Start with a Watchlist and a People list — or any list you like.</p> : null}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((l) => (
          <li key={l.id}>
            <Link href={`/lists/${l.id}`} className={`${cls.card} ${cls.cardHover} flex h-full flex-col gap-1 p-5`}>
              <span className="mb-2 grid size-10 place-items-center rounded-xl border border-line bg-panel-2 text-xl shadow-raised" aria-hidden>
                {l.emoji ?? KIND_COPY[l.kind].emoji}
              </span>
              <span className="font-medium">{l.name}</span>
              <span className="tabular text-xs text-muted">
                {Number(l.total)} items · {l.done} {KIND_COPY[l.kind].status.done.toLowerCase()}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <section className={`${cls.card} p-4`}>
        <h2 className={`${cls.h2} mb-3`}>New list</h2>
        <NewListForm />
      </section>
    </div>
  );
}
