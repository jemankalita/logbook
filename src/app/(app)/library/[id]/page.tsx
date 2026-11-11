/* eslint-disable @next/next/no-img-element -- remote preview images from arbitrary sites */
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, RefreshCw, Trash2 } from "lucide-react";
import { Tweet } from "react-tweet";
import { cls } from "@/components/cls";
import { Favicon } from "@/components/library/item-card";
import { TYPE_LABELS } from "@/components/library/labels";
import { ConfirmButton, SubmitButton } from "@/components/ui";
import { uuid } from "@/lib/actions";
import { flattenTree, folderBreadcrumbs, getFolderTree, getItem } from "@/lib/queries/library";
import { hostnameOf, tweetIdFromUrl, youtubeIdFromUrl } from "@/lib/url";
import { deleteItem, refreshPreview } from "../actions";
import { ItemForm } from "./item-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = uuid.safeParse(id).success ? await getItem(id) : null;
  return { title: `${item?.title ?? "Link"} · Logbook` };
}

function Embed({ url, image }: { url: string | null; image: string | null }) {
  const tweetId = tweetIdFromUrl(url);
  if (tweetId) {
    return (
      <div data-theme="dark" className="flex justify-center">
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
  if (image) {
    return <img src={image} alt="" referrerPolicy="no-referrer" className="max-h-96 w-full rounded-xl border border-line object-cover" />;
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
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Link href={backHref} className={`${cls.btnGhost} self-start`}>
        <ArrowLeft className="size-4" aria-hidden /> {crumbs.length ? crumbs.map((c) => c.name).join(" / ") : "Library"}
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <article className="flex min-w-0 flex-col gap-4">
          <header className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm text-muted">
              <Favicon item={item} />
              <span className="truncate">{hostnameOf(item.url)}</span>
              <span className={cls.chip}>{TYPE_LABELS[item.type]}</span>
            </div>
            <h1 className="break-words text-xl font-semibold leading-snug md:text-2xl">{item.title}</h1>
            <p className="text-xs text-muted">
              Saved {saved}
              {item.source ? ` · from ${item.source}` : ""}
            </p>
          </header>

          <Embed url={item.url} image={item.image} />

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
