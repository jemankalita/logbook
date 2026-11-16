"use client";
/* eslint-disable @next/next/no-img-element -- tiny fixed-size CDN glyphs; next/image would add a round-trip per emoji */

import { useCallback, useMemo, useState } from "react";
import { appleEmojiUrls, isEmoji, splitEmoji } from "@/lib/emoji";

interface EmojiProps {
  /** One emoji (a grapheme). Anything that isn't an emoji renders as plain text. */
  char: string;
  /** CSS size; defaults to a touch above the surrounding font size, like native emoji. */
  size?: string;
  className?: string;
  /** Accessible name. Omit for decorative emoji (the parent should be aria-hidden or labelled). */
  label?: string;
}

/**
 * One emoji drawn with Apple's artwork, the same on Windows, Android and Mac.
 * Falls back through alternate file names, then to the native glyph, so it never shows a broken image.
 */
export function Emoji({ char, size = "1.15em", className = "", label }: EmojiProps) {
  const urls = useMemo(() => (isEmoji(char) ? appleEmojiUrls(char) : []), [char]);
  const [failed, setFailed] = useState({ char, count: 0 });
  const attempt = failed.char === char ? failed.count : 0;
  const fail = useCallback(() => setFailed((f) => ({ char, count: (f.char === char ? f.count : 0) + 1 })), [char]);
  // An error that fires before hydration never reaches onError; catch it when the node mounts.
  const check = useCallback(
    (img: HTMLImageElement | null) => {
      if (img?.complete && img.naturalWidth === 0) fail();
    },
    [fail],
  );

  if (attempt >= urls.length) {
    return (
      <span className={className} role={label ? "img" : undefined} aria-label={label}>
        {char}
      </span>
    );
  }
  return (
    <img
      ref={check}
      src={urls[attempt]}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      draggable={false}
      decoding="async"
      width={64}
      height={64}
      onError={fail}
      className={`inline-block shrink-0 select-none align-[-0.2em] ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/** Text with every emoji inside it swapped for the Apple version ("🎓 Masters Abroad" keeps its words). */
export function EmojiText({ text, size, className }: { text: string; size?: string; className?: string }) {
  const parts = useMemo(() => splitEmoji(text), [text]);
  return (
    <span className={className}>
      {parts.map((p, i) => (p.kind === "emoji" ? <Emoji key={i} char={p.value} size={size} /> : <span key={i}>{p.value}</span>))}
    </span>
  );
}
