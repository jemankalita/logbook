import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { Pin, Plus, Search } from "lucide-react";
import { getDb } from "@/db/client";
import { items } from "@/db/schema";
import { cls } from "@/components/cls";
import { SubmitButton } from "@/components/ui";
import { itemSearchCondition } from "@/lib/queries/library";
import { excerpt } from "@/lib/rich-text";
import { createNote } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notes · Logbook" };

const LIMIT = 200;

export default async function NotesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (await searchParams).q?.slice(0, 200) ?? "";
  const db = await getDb();
  const notes = await db
    .select({ id: items.id, title: items.title, bodyText: items.bodyText, starred: items.starred, updatedAt: items.updatedAt })
    .from(items)
    .where(and(eq(items.kind, "note"), q.trim() ? itemSearchCondition(q) : undefined))
    .orderBy(desc(items.starred), desc(items.updatedAt))
    .limit(LIMIT);
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={cls.h1}>Notes</h1>
        <form action={createNote}>
          <SubmitButton pendingLabel="Creating…">
            <Plus className="size-4" aria-hidden /> New note
          </SubmitButton>
        </form>
      </header>

      <form action="/notes" className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted" aria-hidden />
        <label className="sr-only" htmlFor="notes-q">
          Search notes
        </label>
        <input id="notes-q" name="q" type="search" defaultValue={q} placeholder="Search notes…" className={`${cls.input} pl-8`} />
      </form>

      {notes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center text-sm text-muted">{q ? `No notes match “${q}”.` : "No notes yet. Create one, or press Ctrl+K and type."}</div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((n) => (
            <li key={n.id}>
              <Link href={`/notes/${n.id}`} className={`${cls.card} flex h-full flex-col gap-1 p-4 transition hover:border-muted/40`}>
                <h2 className="flex items-start gap-1.5 font-medium">
                  {n.starred ? <Pin className="mt-1 size-3.5 shrink-0 text-accent" aria-label="Pinned" /> : null}
                  <span className="line-clamp-2">{n.title}</span>
                </h2>
                <p className="line-clamp-3 text-sm text-muted">{excerpt(n.bodyText, 220) || "Empty note"}</p>
                <p className="mt-auto pt-2 text-xs text-muted">Edited {fmt.format(n.updatedAt)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
