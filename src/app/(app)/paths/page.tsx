import Link from "next/link";
import { asc, count, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { paths, tasks } from "@/db/schema";
import { cls } from "@/components/cls";
import { SubmitButton } from "@/components/ui";
import { createPath } from "./actions";
import { PageHeader } from "@/components/page-ui";
import { Emoji } from "@/components/emoji";

export const dynamic = "force-dynamic";
export const metadata = { title: "Paths · Logbook" };

export default async function PathsPage() {
  const db = await getDb();
  const rows = await db
    .select({
      id: paths.id,
      name: paths.name,
      emoji: paths.emoji,
      description: paths.description,
      total: count(tasks.id),
      done: sql<number>`count(*) filter (where ${tasks.status} = 'done')`.mapWith(Number),
    })
    .from(paths)
    .leftJoin(tasks, eq(tasks.pathId, paths.id))
    .groupBy(paths.id)
    .orderBy(asc(paths.position), asc(paths.name));

  return (
    <div className="rise mx-auto flex max-w-4xl flex-col gap-5">
      <PageHeader eyebrow="Goals" title="Paths" description="Long-term roadmaps — a plan you write, plus the tasks that get you there." />
      <ul className="grid gap-3 sm:grid-cols-2">
        {rows.map((p) => {
          const total = Number(p.total);
          const pct = total ? Math.round((p.done / total) * 100) : 0;
          return (
            <li key={p.id}>
              <Link href={`/paths/${p.id}`} className={`${cls.card} ${cls.cardHover} flex h-full flex-col gap-2 p-5`}>
                <span className="flex items-center gap-2 font-medium">
                  <span className="text-2xl" aria-hidden>
                    <Emoji char={p.emoji ?? "🧭"} size="1.6rem" />
                  </span>
                  {p.name}
                </span>
                {p.description ? <span className="line-clamp-2 text-sm text-muted">{p.description}</span> : null}
                <span className="mt-auto flex items-center gap-2 text-xs text-muted">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2">
                    <span className="block h-full bg-success" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="tabular">
                    {p.done}/{total} tasks
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <section className={`${cls.card} p-4`}>
        <h2 className="mb-3 font-medium">New path</h2>
        <form action={createPath} className="flex flex-wrap items-end gap-2">
          <input name="emoji" aria-label="Emoji" maxLength={16} placeholder="🎓" className={cls.inputEmoji} />
          <input name="name" aria-label="Path name" required maxLength={120} placeholder="Masters Abroad, Become a ML engineer…" className={`${cls.input} min-w-48 flex-1`} />
          <SubmitButton pendingLabel="Creating…">Create</SubmitButton>
          <input name="description" aria-label="One-line goal" maxLength={500} placeholder="One-line goal (optional)" className={`${cls.input} basis-full`} />
        </form>
      </section>
    </div>
  );
}
