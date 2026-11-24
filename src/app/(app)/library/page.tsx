import Link from "next/link";
import { Bookmark, FileText, FolderPlus, Inbox, Pencil, Search, SearchX, Upload } from "lucide-react";
import { excerpt } from "@/lib/rich-text";
import { cls } from "@/components/cls";
import { FolderTree, type FolderSelection } from "@/components/library/folder-tree";
import { AddLinkForm, FolderForm } from "@/components/library/forms";
import { ItemCard } from "@/components/library/item-card";
import { STATUS_LABELS } from "@/components/library/labels";
import { ConfirmButton } from "@/components/ui";
import { uuid } from "@/lib/actions";
import { descendantIds, flattenTree, folderBreadcrumbs, getFolderTree, ITEM_STATUSES, libraryCounts, listItems, type ItemStatus } from "@/lib/queries/library";
import { deleteFolder } from "./actions";
import { EmptyState, Kbd } from "@/components/page-ui";
import { Segmented } from "@/components/segmented";
import { Emoji } from "@/components/emoji";

export const dynamic = "force-dynamic";
export const metadata = { title: "Library · Logbook" };

const PAGE_SIZE = 60;
const PAGES_LIMIT = 100;

interface Params {
  folder?: string;
  q?: string;
  status?: string;
  page?: string;
  edit?: string;
}

function parseSelection(folder: string | undefined): FolderSelection {
  if (folder === "unsorted" || folder === "starred") return { kind: folder };
  if (folder && uuid.safeParse(folder).success) return { kind: "folder", id: folder };
  return { kind: "all" };
}

function hrefWith(params: Params, patch: Partial<Params>): string {
  const merged: Params = { ...params, ...patch };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (typeof v === "string" && v) qs.set(k, v);
  const s = qs.toString();
  return s ? `/library?${s}` : "/library";
}

export default async function LibraryPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const selected = parseSelection(params.folder);
  const status = (ITEM_STATUSES as readonly string[]).includes(params.status ?? "") ? (params.status as ItemStatus) : undefined;
  const page = Math.max(1, Math.min(1000, Number(params.page) || 1));
  const q = params.q?.slice(0, 200);

  const [tree, counts] = await Promise.all([getFolderTree(), libraryCounts()]);
  const flat = flattenTree(tree);
  const folderOptions = flat.map((f) => ({ id: f.id, label: `${"  ".repeat(f.depth)}${f.emoji ? `${f.emoji} ` : ""}${f.name}` }));
  const current = selected.kind === "folder" ? flat.find((f) => f.id === selected.id) : undefined;
  const crumbs = current ? folderBreadcrumbs(tree, current.id) : [];

  const folderIds = selected.kind === "folder" ? descendantIds(tree, selected.id) : selected.kind === "unsorted" ? "unsorted" : undefined;
  const [{ rows, total }, pages] = await Promise.all([
    listItems({ folderIds, starred: selected.kind === "starred", q, status, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    // Pages (notes) filed in this folder: shown above the links so imported Notion rows aren't invisible here.
    selected.kind === "folder" && page === 1 && !status ? listItems({ folderIds, kind: "note", q, limit: PAGES_LIMIT }) : Promise.resolve({ rows: [], total: 0 }),
  ]);

  const title = current ? current.name : selected.kind === "starred" ? "Starred" : selected.kind === "unsorted" ? "Unsorted" : "Library";
  const editing = Boolean(current && params.edit === "1");

  return (
    <div className="rise mx-auto flex max-w-7xl flex-col gap-6 lg:flex-row">
      <aside className="lg:w-60 lg:shrink-0">
        <details className="rounded-xl border border-line bg-panel shadow-card p-3 lg:sticky lg:top-6 lg:border-0 lg:bg-transparent lg:p-0" open>
          <summary className="cursor-pointer list-none text-sm font-medium lg:hidden">Folders ▾</summary>
          <div className="mt-3 lg:mt-0">
            <FolderTree tree={tree} selected={selected} counts={counts} />
            <details className="mt-4 rounded-xl border border-line bg-panel p-3">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-muted hover:text-fg">
                <FolderPlus className="size-4" aria-hidden /> New folder
              </summary>
              <div className="mt-3">
                <FolderForm folders={folderOptions} />
              </div>
            </details>
            <Link href="/library/import" className={`${cls.btnGhost} mt-2 w-full justify-start`}>
              <Upload className="size-4" aria-hidden /> Import &amp; tools
            </Link>
          </div>
        </details>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <header className="flex flex-col gap-2">
          {crumbs.length > 1 ? (
            <p className={cls.eyebrow}>
              {crumbs.slice(0, -1).map((c) => (
                <span key={c.id}>
                  <Link href={`/library?folder=${c.id}`} className="transition-colors duration-150 hover:text-fg">
                    {c.name}
                  </Link>{" "}
                  /{" "}
                </span>
              ))}
            </p>
          ) : (
            <p className={cls.eyebrow}>Library</p>
          )}
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className={cls.h1}>
              {current?.emoji ? <Emoji char={current.emoji} size="0.9em" className="mr-3" /> : null}
              {title}
            </h1>
            <span className="tabular text-sm text-muted">
              {total} {total === 1 ? "link" : "links"}
              {pages.total ? ` · ${pages.total} ${pages.total === 1 ? "page" : "pages"}` : ""}
            </span>
            {current ? (
              <Link href={hrefWith(params, { edit: editing ? undefined : "1" })} className={`${cls.btnGhost} self-center`}>
                <Pencil className="size-4" aria-hidden /> {editing ? "Close" : "Edit folder"}
              </Link>
            ) : null}
          </div>
        </header>

        {editing && current ? (
          <section className={`${cls.card} flex flex-col gap-4 p-4`}>
            <FolderForm folders={folderOptions} folder={current} />
            <form action={deleteFolder.bind(null, current.id)} className="border-t border-line pt-4">
              <ConfirmButton message={`Delete “${current.name}” and its sub-folders? Links inside are kept and move to Unsorted.`}>Delete folder</ConfirmButton>
            </form>
          </section>
        ) : null}

        <section className={`${cls.card} p-4`}>
          <AddLinkForm folders={folderOptions} defaultFolderId={current?.id} />
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <form action="/library" className="relative min-w-0 flex-1 sm:max-w-xs">
            {params.folder ? <input type="hidden" name="folder" value={params.folder} /> : null}
            {status ? <input type="hidden" name="status" value={status} /> : null}
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
            <label className="sr-only" htmlFor="lib-q">
              Search links
            </label>
            <input id="lib-q" name="q" type="search" defaultValue={q} placeholder="Search links…" className={`${cls.input} pl-8`} />
          </form>
          <Segmented
            label="Status"
            items={[undefined, ...ITEM_STATUSES].map((s) => ({ href: hrefWith(params, { status: s, page: undefined }), label: s ? STATUS_LABELS[s] : "Any", active: s === status }))}
          />
        </div>

        {pages.rows.length ? (
          <section aria-labelledby="folder-pages">
            <h2 id="folder-pages" className={`${cls.eyebrow} mb-2`}>
              Pages
            </h2>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {pages.rows.map((n) => (
                <li key={n.id}>
                  <Link href={`/notes/${n.id}`} className={`${cls.card} ${cls.cardHover} flex items-start gap-3 p-3`}>
                    <FileText className="mt-0.5 size-4 shrink-0 text-faint" aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{n.title}</span>
                      <span className="line-clamp-1 text-xs text-muted">{excerpt(n.bodyText, 120) || "Title only — open to add notes"}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {rows.length === 0 && pages.rows.length > 0 && !q ? null : rows.length === 0 ? (
          q ? (
            <EmptyState icon={SearchX} title={`Nothing matches “${q}”`}>Try a shorter search, or clear the status filter.</EmptyState>
          ) : counts.links === 0 ? (
            <EmptyState
              icon={Bookmark}
              title="Your library is empty"
              action={
                <Link href="/library/import" className={cls.btn}>
                  Import Chrome bookmarks
                </Link>
              }
            >
              Paste a link above, or press <Kbd>Ctrl</Kbd> <Kbd>K</Kbd> anywhere to save one.
            </EmptyState>
          ) : (
            <EmptyState icon={Inbox} title="Nothing here yet">Links you file in this view will show up here.</EmptyState>
          )
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {rows.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}

        {total > PAGE_SIZE ? (
          <nav className="flex items-center justify-center gap-3 text-sm" aria-label="Pages">
            {page > 1 ? (
              <Link className={cls.btn} href={hrefWith(params, { page: String(page - 1) })}>
                ← Newer
              </Link>
            ) : null}
            <span className="tabular text-muted">
              Page {page} of {Math.ceil(total / PAGE_SIZE)}
            </span>
            {page * PAGE_SIZE < total ? (
              <Link className={cls.btn} href={hrefWith(params, { page: String(page + 1) })}>
                Older →
              </Link>
            ) : null}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
