import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { ListTodo, Pin, Plus, Search, Trash2 } from "lucide-react";
import { convertNoteToTask } from "../tasks/actions";
import { getDb } from "@/db/client";
import { items } from "@/db/schema";
import { cls } from "@/components/cls";
import { ConfirmButton, SubmitButton } from "@/components/ui";
import { itemSearchCondition } from "@/lib/queries/library";
import { excerpt } from "@/lib/rich-text";
import { createNote, deleteNote } from "./actions";
import { PageHeader } from "@/components/page-ui";

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
  // Title-only notes (mostly Notion rows that never had content) are really to-dos; list them apart.
  const isTitleOnly = (n: (typeof notes)[number]) => !n.bodyText?.trim() && !n.starred;
  const titleOnly = q.trim() ? [] : notes.filter(isTitleOnly);
  const written = q.trim() ? notes : notes.filter((n) => !isTitleOnly(n));

  return (
    <div className="rise mx-auto flex max-w-5xl flex-col gap-5">
      <PageHeader
        eyebrow="Knowledge"
        title="Notes"
        description="Longer thinking — summaries, drafts, ideas. Link to anything in your library."
        actions={
          <form action={createNote}>
            <SubmitButton pendingLabel="Creating…">
              <Plus className="size-4" aria-hidden /> New note
            </SubmitButton>
          </form>
        }
      />

      <form action="/notes" className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
        <label className="sr-only" htmlFor="notes-q">
          Search notes
        </label>
        <input id="notes-q" name="q" type="search" defaultValue={q} placeholder="Search notes…" className={`${cls.input} pl-8`} />
      </form>

      {notes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong/70 px-6 py-12 text-center text-sm text-muted">{q ? `No notes match “${q}”.` : "No notes yet. Create one, or press Ctrl+K and type."}</div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {written.map((n) => (
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

      {titleOnly.length ? (
        <section className={`${cls.card} overflow-hidden`} aria-labelledby="title-only">
          <header className="border-b border-line px-4 py-3">
            <h2 id="title-only" className="font-medium">
              Title-only notes <span className="tabular text-faint">{titleOnly.length}</span>
            </h2>
            <p className="mt-0.5 text-[13px] text-muted">These have a name but nothing written yet. Turn a to-do into a task, or delete what you don&apos;t need.</p>
          </header>
          <ul>
            {titleOnly.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2 last:border-b-0">
                <Link href={`/notes/${n.id}`} className="min-w-0 flex-1 truncate text-sm font-medium underline-offset-4 hover:underline">
                  {n.title}
                </Link>
                <form action={convertNoteToTask.bind(null, n.id)}>
                  <SubmitButton pendingLabel="Moving…" className={`${cls.btn} h-7 px-2.5 text-[12px]`}>
                    <ListTodo className="size-3.5" aria-hidden /> Make it a task
                  </SubmitButton>
                </form>
                <form action={deleteNote.bind(null, n.id)}>
                  <ConfirmButton message={`Delete “${n.title}”?`} className={`${cls.btnGhost} h-7 text-[12px] hover:text-danger`} aria-label={`Delete “${n.title}”`}>
                    <Trash2 className="size-3.5" aria-hidden />
                  </ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
