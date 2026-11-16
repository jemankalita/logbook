"use client";
/* eslint-disable @next/next/no-img-element -- remote preview images from arbitrary sites */

import { useEffect, useRef, useState } from "react";
import { areaColor } from "@/lib/colors";
import type { Item } from "@/lib/queries/library";
import { hostnameOf } from "@/lib/url";

type FaviconItem = Pick<Item, "favicon" | "url" | "title">;

/**
 * Tracks whether a remote image failed. `onError` alone misses images that fail before React
 * hydrates (the event fires on the server-rendered <img> with no listener attached yet), so on
 * mount we also check for an image that finished loading with no pixels.
 */
function useBrokenImage(src: string | null) {
  const ref = useRef<HTMLImageElement>(null);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setBroken(true);
  }, [src]);
  return { ref, broken, onError: () => setBroken(true) };
}

/** Site icon, or the site's first letter when there is none or it fails to load. */
export function Favicon({ item, size = "size-4" }: { item: FaviconItem; size?: string }) {
  const { ref, broken, onError } = useBrokenImage(item.favicon);
  if (item.favicon && !broken) {
    return <img ref={ref} src={item.favicon} alt="" loading="lazy" referrerPolicy="no-referrer" onError={onError} className={`${size} shrink-0 rounded-[4px] object-contain`} />;
  }
  const letter = (hostnameOf(item.url) || item.title || "?").charAt(0).toUpperCase();
  return (
    <span aria-hidden className={`${size} grid shrink-0 place-items-center rounded-[4px] bg-panel-3 text-[10px] font-semibold text-muted`}>
      {letter}
    </span>
  );
}

/**
 * The picture at the top of a link card. Uses the page's preview image when it has one that
 * loads; otherwise draws a cover from the site itself — tinted with a colour derived from the
 * hostname (so a site always gets the same one), its icon, and its name on ruled paper.
 */
export function LinkCover({ item, imgClassName = "" }: { item: FaviconItem & Pick<Item, "image">; imgClassName?: string }) {
  const { ref, broken, onError } = useBrokenImage(item.image);
  if (item.image && !broken) {
    return <img ref={ref} src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={onError} className={`img-edge size-full object-cover ${imgClassName}`} />;
  }

  const host = hostnameOf(item.url);
  const tint = areaColor(host || item.title);
  return (
    <div className="ruled relative flex size-full items-end overflow-hidden p-3.5" style={{ backgroundColor: `color-mix(in oklab, ${tint} 13%, var(--panel-2))` }}>
      <div aria-hidden className="absolute -right-8 -top-12 size-40 rounded-full blur-2xl" style={{ background: `color-mix(in oklab, ${tint} 28%, transparent)` }} />
      <div className="relative flex min-w-0 items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-panel shadow-raised">
          <Favicon item={item} />
        </span>
        <span className="truncate font-display text-[1.35rem] leading-none tracking-[-0.01em] text-fg/90">{host || "Saved link"}</span>
      </div>
    </div>
  );
}
