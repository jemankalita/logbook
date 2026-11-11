/* eslint-disable @next/next/no-img-element -- remote preview images from arbitrary sites */
import Link from "next/link";
import { Check, ExternalLink, Star } from "lucide-react";
import { setItemStatus, toggleStar } from "@/app/(app)/library/actions";
import type { Item } from "@/lib/queries/library";
import { hostnameOf } from "@/lib/url";
import { TYPE_LABELS } from "./labels";

export function Favicon({ item, size = "size-4" }: { item: Pick<Item, "favicon" | "url" | "title">; size?: string }) {
  if (item.favicon) {
    return <img src={item.favicon} alt="" loading="lazy" referrerPolicy="no-referrer" className={`${size} shrink-0 rounded-sm object-contain`} />;
  }
  const letter = (hostnameOf(item.url) || item.title || "?").charAt(0).toUpperCase();
  return (
    <span aria-hidden className={`${size} grid shrink-0 place-items-center rounded-sm bg-line text-[10px] font-semibold text-muted`}>
      {letter}
    </span>
  );
}

function Thumb({ item }: { item: Item }) {
  if (item.image) {
    return (
      <img
        src={item.image}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        className="aspect-[1.91/1] w-full rounded-t-2xl border-b border-line bg-panel-2 object-cover"
      />
    );
  }
  return (
    <div className="grid aspect-[1.91/1] w-full place-items-center rounded-t-2xl border-b border-line bg-panel-2">
      <Favicon item={item} size="size-8" />
    </div>
  );
}

const overlayBtn = "grid size-7 place-items-center rounded-lg bg-black/60 text-white backdrop-blur transition hover:bg-black/80";

export function ItemCard({ item }: { item: Item }) {
  const host = hostnameOf(item.url);
  const done = item.status === "done";

  return (
    <article className={`group relative flex flex-col rounded-2xl border border-line bg-panel transition hover:border-muted/40 ${done ? "opacity-60" : ""}`}>
      <Link href={`/library/${item.id}`} className="flex flex-1 flex-col rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <Thumb item={item} />
        <div className="flex flex-1 flex-col gap-1 p-3">
          <h3 className="line-clamp-2 text-sm font-medium leading-snug">{item.title}</h3>
          {item.summary ? (
            <p className="line-clamp-2 text-xs text-fg/80">{item.summary}</p>
          ) : item.description ? (
            <p className="line-clamp-2 text-xs text-muted">{item.description}</p>
          ) : null}
          <div className="mt-auto flex items-center gap-1.5 pt-2 text-xs text-muted">
            <Favicon item={item} size="size-3.5" />
            <span className="truncate">{host}</span>
            <span className="ml-auto shrink-0 rounded bg-panel-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">{TYPE_LABELS[item.type]}</span>
          </div>
        </div>
      </Link>

      <div className="absolute right-2 top-2 flex gap-1 transition md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
        <form action={toggleStar.bind(null, item.id)}>
          <button type="submit" aria-label={item.starred ? "Unstar" : "Star"} aria-pressed={item.starred} className={overlayBtn}>
            <Star className={`size-3.5 ${item.starred ? "fill-yellow-400 text-yellow-400" : ""}`} aria-hidden />
          </button>
        </form>
        <form action={setItemStatus.bind(null, item.id, done ? "unread" : "done")}>
          <button type="submit" aria-label={done ? "Mark as not done" : "Mark as done"} aria-pressed={done} className={overlayBtn}>
            <Check className={`size-3.5 ${done ? "text-success" : ""}`} aria-hidden />
          </button>
        </form>
        {item.url ? (
          <a href={item.url} target="_blank" rel="noopener noreferrer" aria-label="Open link in new tab" className={overlayBtn}>
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        ) : null}
      </div>
      {item.starred ? (
        <span className="absolute left-2 top-2" title="Starred">
          <Star className="size-4 fill-yellow-400 text-yellow-400 drop-shadow" aria-label="Starred" />
        </span>
      ) : null}
    </article>
  );
}
