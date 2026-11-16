import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ExternalLink, RefreshCw, Trash2 } from "lucide-react";
import { Tweet } from "react-tweet";
import { cls } from "@/components/cls";
import { Favicon, LinkCover } from "@/components/library/link-cover";
import { TYPE_LABELS } from "@/components/library/labels";
import { BackLink } from "@/components/page-ui";
import { ConfirmButton, SubmitButton } from "@/components/ui";
import { uuid } from "@/lib/actions";
import { flattenTree, folderBreadcrumbs, getFolderTree, getItem, type Item } from "@/lib/queries/library";
import { hostnameOf, tweetIdFromUrl, youtubeIdFromUrl } from "@/lib/url";
import { deleteItem, refreshPreview } from "../actions";
import { ItemForm } from "./item-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = uuid.safeParse(id).success ? await getItem(id) : null;
  return { title: `${item?.title ?? "Link"} · Logbook` };
}

function Embed({ item }: { item: Item }) {
  const { url } = item;
  const tweetId = tweetIdFromUrl(url);
  if (tweetId) {
    return (
      <div className="flex justify-center">
        <Suspense fallback={<div className="h-48 w-full animate-pulse rounded-xl bg-panel-2" />}>
          <Tweet id={tweetId} />
        </Suspense>
      </div>
    );
  }
  const yt = youtubeIdFromUrl(url);
  if (yt) {
    return (
      <div className="aspect-video overflow-hidden rounded-xl border border-line bg-black">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${yt}`}
          title="YouTube video"
          className="size-full"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }
  if (item.image) {
    return (
      <div className="aspect-[1.91/1] max-h-96 w-full overflow-hidden rounded-xl border border-line bg-panel-2">
        <LinkCover item={item} />
      </div>
    );
  }
  return null;
}

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const [item, tree] = await Promise.all([getItem(id), getFolderTree()]);
  if (!item) notFound();

  const folderOptions = flattenTree(tree).map((f) => ({ id: f.id, label: `${"  ".repeat(f.depth)}${f.emoji ? `${f.emoji} ` : ""}${f.name}` }));
  const crumbs = item.folderId ? folderBreadcrumbs(tree, item.folderId) : [];
  const backHref = item.folderId ? `/library?folder=${item.folderId}` : "/library";
  const saved = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(item.createdAt);

  return (
    <div className="rise mx-auto flex max-w-5xl flex-col gap-6">
      <BackLink href={backHref}>{crumbs.length ? crumbs.map((c) => c.name).join(" / ") : "Library"}</BackLink>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <article className="flex min-w-0 flex-col gap-4">
          <header className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm text-muted">
              <Favicon item={item} />
              <span className="truncate">{hostnameOf(item.url)}</span>
              <span className={cls.chip}>{TYPE_LABELS[item.type]}</span>
            </div>
            <h1 className="break-words font-display text-[1.75rem] leading-[1.15] tracking-[-0.01em] md:text-[2.25rem]">{item.title}</h1>
            <p className="text-xs text-muted">
              Saved {saved}
              {item.source ? ` · from ${item.source}` : ""}
            </p>
          </header>

          <Embed item={item} />

          {item.description && item.type !== "tweet" ? <p className="whitespace-pre-line text-sm leading-relaxed text-fg/85">{item.description}</p> : null}

          <div className="flex flex-wrap gap-2">
            {item.url ? (
              <a href={item.url} target="_blank" rel="noopener noreferrer" className={cls.btnPrimary}>
                <ExternalLink className="size-4" aria-hidden /> Open
              </a>
            ) : null}
            {item.url ? (
              <form action={refreshPreview.bind(null, item.id)}>
                <SubmitButton className={cls.btn} pendingLabel="Refreshing…">
                  <RefreshCw className="size-4" aria-hidden /> Refresh preview
                </SubmitButton>
              </form>
            ) : null}
            <form action={deleteItem.bind(null, item.id, backHref)}>
              <ConfirmButton message="Delete this link from your Library?">
                <Trash2 className="size-4" aria-hidden /> Delete
              </ConfirmButton>
            </form>
          </div>
        </article>

        <aside className={`${cls.card} h-fit p-4`}>
          <ItemForm item={item} folders={folderOptions} />
        </aside>
      </div>
    </div>
  );
}
