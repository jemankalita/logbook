import Link from "next/link";
import { Check, ExternalLink, Star } from "lucide-react";
import { setItemStatus, toggleStar } from "@/app/(app)/library/actions";
import { cls } from "@/components/cls";
import type { Item } from "@/lib/queries/library";
import { hostnameOf } from "@/lib/url";
import { TYPE_LABELS } from "./labels";
import { Favicon, LinkCover } from "./link-cover";

export { Favicon };

function Thumb({ item }: { item: Item }) {
  return (
    <div className="relative aspect-[1.91/1] w-full overflow-hidden rounded-t-[11px] border-b border-line bg-panel-2">
      <LinkCover item={item} imgClassName="transition-transform duration-500 ease-out group-hover:scale-[1.03]" />
    </div>
  );
}

const overlayBtn =
  "grid size-8 place-items-center rounded-lg border border-white/10 bg-black/65 text-white backdrop-blur-sm transition-[background-color,transform] duration-150 hover:bg-black/85 active:scale-95";

export function ItemCard({ item }: { item: Item }) {
  const host = hostnameOf(item.url);
  const done = item.status === "done";

  return (
    <article className={`${cls.card} ${cls.cardHover} group relative flex flex-col ${done ? "opacity-55 hover:opacity-100" : ""}`}>
      <Link href={`/library/${item.id}`} className="flex flex-1 flex-col rounded-xl">
        <Thumb item={item} />
        <div className="flex flex-1 flex-col gap-1.5 p-3.5">
          <h3 className="line-clamp-2 text-sm font-medium leading-snug">{item.title}</h3>
          {item.summary ? (
            <p className="line-clamp-2 text-xs leading-relaxed text-fg/75">{item.summary}</p>
          ) : item.description ? (
            <p className="line-clamp-2 text-xs leading-relaxed text-muted">{item.description}</p>
          ) : null}
          <div className="mt-auto flex items-center gap-1.5 pt-2.5 text-xs text-faint">
            <Favicon item={item} size="size-3.5" />
            <span className="truncate">{host}</span>
            <span className={`${cls.chip} ml-auto shrink-0`}>{TYPE_LABELS[item.type]}</span>
          </div>
        </div>
      </Link>

      <div className="absolute right-2 top-2 flex gap-1 transition-opacity duration-150 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
        <form action={toggleStar.bind(null, item.id)}>
          <button type="submit" aria-label={item.starred ? "Unstar" : "Star"} aria-pressed={item.starred} className={overlayBtn}>
            <Star className={`size-3.5 ${item.starred ? "fill-warn text-warn" : ""}`} aria-hidden />
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
        <span className="absolute left-2.5 top-2.5 grid size-6 place-items-center rounded-md bg-black/60 backdrop-blur-sm" title="Starred">
          <Star className="size-3.5 fill-warn text-warn" aria-label="Starred" />
        </span>
      ) : null}
    </article>
  );
}
