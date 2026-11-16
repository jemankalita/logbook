/**
 * Apple-style emoji everywhere: native emoji fonts differ per OS (Segoe on Windows, Noto on
 * Android), so emoji are drawn from Apple's artwork as images instead. Pure helpers live here so
 * they can be unit-tested; the React side is `components/emoji.tsx`.
 */

/** Pinned so the artwork never changes underneath us. */
export const APPLE_EMOJI_CDN = "https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.1.2/img/apple/64/";

const VS16 = 0xfe0f;
const KEYCAP = 0x20e3;
const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;
const PRESENTATION = /\p{Emoji_Presentation}/u;
const REGIONAL = /\p{Regional_Indicator}/u;
const isModifier = (cp: number) => cp >= 0x1f3fb && cp <= 0x1f3ff;

const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter("en", { granularity: "grapheme" }) : null;

/** Split into user-perceived characters (so 🧑‍🤝‍🧑 stays one piece). */
function graphemes(text: string): string[] {
  return segmenter ? Array.from(segmenter.segment(text), (s) => s.segment) : Array.from(text);
}

/** Is this one grapheme an emoji we can draw? */
export function isEmoji(grapheme: string): boolean {
  if (!grapheme) return false;
  if (PICTOGRAPHIC.test(grapheme) && !/^[©®™]$/u.test(grapheme)) return true;
  if (REGIONAL.test(grapheme)) return true;
  return grapheme.includes(String.fromCodePoint(KEYCAP));
}

export type EmojiPart = { kind: "text"; value: string } | { kind: "emoji"; value: string };

/** "Hi 👋 there" → text / emoji / text, merging adjacent text. */
export function splitEmoji(text: string): EmojiPart[] {
  const parts: EmojiPart[] = [];
  for (const g of graphemes(text)) {
    const last = parts.at(-1);
    if (isEmoji(g)) parts.push({ kind: "emoji", value: g });
    else if (last?.kind === "text") parts[parts.length - 1] = { kind: "text", value: last.value + g };
    else parts.push({ kind: "text", value: g });
  }
  return parts;
}

const hex = (cps: number[]) => cps.map((cp) => cp.toString(16).padStart(4, "0")).join("-");

/**
 * Image file names are the *fully qualified* sequence: symbols that default to text style
 * (🗂 U+1F5C2, ❤ U+2764, ♂ U+2642…) carry a U+FE0F selector, everything else doesn't.
 * Returns the qualified name first and the selector-free name as a fallback.
 */
export function appleEmojiFiles(emoji: string): string[] {
  const cps = Array.from(emoji, (c) => c.codePointAt(0)!);
  const qualified: number[] = [];
  cps.forEach((cp, i) => {
    if (cp === VS16) {
      if (qualified.at(-1) !== VS16) qualified.push(cp);
      return;
    }
    qualified.push(cp);
    const next = cps[i + 1];
    const char = String.fromCodePoint(cp);
    const needsSelector = PICTOGRAPHIC.test(char) && !PRESENTATION.test(char) && next !== VS16 && !(next !== undefined && isModifier(next));
    if (needsSelector) qualified.push(VS16);
  });
  const bare = cps.filter((cp) => cp !== VS16);
  return [...new Set([hex(qualified), hex(bare)])].filter((name) => name.length > 0);
}

export function appleEmojiUrls(emoji: string): string[] {
  return appleEmojiFiles(emoji).map((name) => `${APPLE_EMOJI_CDN}${name}.png`);
}
