import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq, sql } from "drizzle-orm";
import { Pencil } from "lucide-react";
import { getDb } from "@/db/client";
import { listEntries, lists } from "@/db/schema";
import { cls } from "@/components/cls";
import { KIND_COPY, type EntryStatus } from "@/components/lists/kind-copy";
import { EditListForm, EntryForm, EntryRow } from "@/components/lists/list-ui";
import { ConfirmButton } from "@/components/ui";
import { uuid } from "@/lib/actions";
import { deleteList } from "../actions";
import { BackLink, PageHeader } from "@/components/page-ui";
import { Emoji } from "@/components/emoji";

export const dynamic = "force-dynamic";

const STATUS_ORDER: EntryStatus[] = ["doing", "todo", "done"];

async function getList(id: string) {
  if (!uuid.safeParse(id).success) return null;
  const db = await getDb();
  const [list] = await db.select().from(lists).where(eq(lists.id, id)).limit(1);
  return list ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const list = await getList((await params).id);
  return { title: `${list?.name ?? "List"} · Logbook` };
}

export default async function ListPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> }) {
  const list = await getList((await params).id);
  if (!list) notFound();
  const editing = (await searchParams).edit === "1";
  const db = await getDb();
  const entries = await db
    .select()
    .from(listEntries)
    .where(eq(listEntries.listId, list.id))
    .orderBy(sql`${listEntries.rating} desc nulls last`, desc(listEntries.updatedAt), asc(listEntries.title));
  const copy = KIND_COPY[list.kind];

  return (
    <div className="rise mx-auto flex max-w-4xl flex-col gap-5">
      <BackLink href="/lists">Lists</BackLink>
      <PageHeader
        title={
          <>
            <span aria-hidden className="mr-2.5 inline-block"><Emoji char={list.emoji ?? copy.emoji} size="0.9em" /></span>
            {list.name}
          </>
        }
        meta={`${entries.length} ${entries.length === 1 ? "entry" : "entries"}`}
        actions={
          <Link href={editing ? `/lists/${list.id}` : `/lists/${list.id}?edit=1`} className={cls.btnGhost}>
            <Pencil className="size-4" aria-hidden /> {editing ? "Close" : "Edit list"}
          </Link>
        }
      />

      {editing ? (
        <section className={`${cls.card} flex flex-col gap-4 p-4`}>
          <EditListForm list={list} />
          <form action={deleteList.bind(null, list.id)} className="border-t border-line pt-4">
            <ConfirmButton message={`Delete “${list.name}” and everything in it?`}>Delete list</ConfirmButton>
          </form>
        </section>
      ) : null}

      <section className={`${cls.card} p-4`}>
        <EntryForm listId={list.id} kind={list.kind} />
      </section>

      {STATUS_ORDER.map((status) => {
        const group = entries.filter((e) => e.status === status);
        if (group.length === 0) return null;
        return (
          <section key={status} className={`${cls.card} p-3`}>
            <h2 className="mb-1 px-2 text-sm font-medium text-muted">
              {copy.status[status]} <span className="tabular">· {group.length}</span>
            </h2>
            <ul>
              {group.map((e) => (
                <EntryRow key={e.id} entry={e} listId={list.id} kind={list.kind} />
              ))}
            </ul>
          </section>
        );
      })}
      {entries.length === 0 ? <p className="text-sm text-muted">Nothing here yet — add the first one above.</p> : null}
    </div>
  );
}
