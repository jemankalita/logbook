import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { Pin, Trash2 } from "lucide-react";
import { getDb } from "@/db/client";
import { items } from "@/db/schema";
import { cls } from "@/components/cls";
import { DocEditor } from "@/components/editor/doc-editor";
import { TitleInput } from "@/components/editor/title-input";
import { BackLink } from "@/components/page-ui";
import { ConfirmButton } from "@/components/ui";
import { uuid } from "@/lib/actions";
import { isDoc } from "@/lib/rich-text";
import { deleteNote, renameNote, saveNoteBody, toggleNotePin } from "../actions";

export const dynamic = "force-dynamic";

async function getNote(id: string) {
  if (!uuid.safeParse(id).success) return null;
  const db = await getDb();
  const [row] = await db.select().from(items).where(and(eq(items.id, id), eq(items.kind, "note"))).limit(1);
  return row ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const note = await getNote((await params).id);
  return { title: `${note?.title ?? "Note"} · Logbook` };
}

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const note = await getNote((await params).id);
  if (!note) notFound();
  const edited = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(note.updatedAt);

  return (
    <div className="rise mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BackLink href="/notes">Notes</BackLink>
        <div className="flex items-center gap-1">
          <span className="tabular mr-1 text-xs text-faint">Edited {edited}</span>
          <form action={toggleNotePin.bind(null, note.id)}>
            <button type="submit" className={cls.btnGhost} aria-pressed={note.starred}>
              <Pin className={`size-4 ${note.starred ? "text-accent" : ""}`} aria-hidden /> {note.starred ? "Pinned" : "Pin"}
            </button>
          </form>
          <form action={deleteNote.bind(null, note.id)}>
            <ConfirmButton message="Delete this note? This can't be undone." className={cls.btnGhost}>
              <Trash2 className="size-4" aria-hidden /> Delete
            </ConfirmButton>
          </form>
        </div>
      </div>
      <TitleInput initial={note.title} save={renameNote.bind(null, note.id)} label="Note title" />
      <DocEditor initial={isDoc(note.body) ? note.body : null} save={saveNoteBody.bind(null, note.id)} label="Note" />
    </div>
  );
}
