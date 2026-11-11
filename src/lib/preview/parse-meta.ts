/** Extract a link card (title, description, image, favicon) from a page's HTML. Pure — no I/O. */

export interface PageMeta {
  title: string | null;
  description: string | null;
  image: string | null;
  favicon: string | null;
  siteName: string | null;
}

const MAX_TITLE = 300;
const MAX_DESCRIPTION = 600;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function safeCodePoint(n: number, fallback: string): string {
  return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : fallback;
}

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (whole, code: string) => {
    const lower = code.toLowerCase();
    if (lower.startsWith("#x")) return safeCodePoint(parseInt(lower.slice(2), 16), whole);
    if (lower.startsWith("#")) return safeCodePoint(parseInt(lower.slice(1), 10), whole);
    return ENTITIES[lower] ?? whole;
  });
}

export function cleanText(text: string | undefined | null, max: number): string | null {
  if (!text) return null;
  const value = decodeEntities(text).replace(/\s+/g, " ").trim();
  if (!value) return null;
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z_:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag))) out[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? "";
  return out;
}

function absolute(href: string | undefined, base: string): string | null {
  if (!href) return null;
  try {
    const url = new URL(decodeEntities(href.trim()), base);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function parseMeta(html: string, baseUrl: string): PageMeta {
  const head = html.slice(0, 400_000);
  const meta = new Map<string, string>();
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const a = attrs(tag);
    const key = (a.property ?? a.name ?? a.itemprop ?? "").toLowerCase();
    if (key && a.content !== undefined && !meta.has(key)) meta.set(key, a.content);
  }

  let favicon: string | null = null;
  for (const tag of head.match(/<link\b[^>]*>/gi) ?? []) {
    const a = attrs(tag);
    if (/\bicon\b/i.test(a.rel ?? "") && a.href) {
      favicon = absolute(a.href, baseUrl);
      if (favicon) break;
    }
  }

  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1];

  return {
    title: cleanText(meta.get("og:title") ?? meta.get("twitter:title") ?? titleTag, MAX_TITLE),
    description: cleanText(meta.get("og:description") ?? meta.get("twitter:description") ?? meta.get("description"), MAX_DESCRIPTION),
    image: absolute(meta.get("og:image:secure_url") ?? meta.get("og:image") ?? meta.get("twitter:image") ?? meta.get("twitter:image:src"), baseUrl),
    favicon: favicon ?? absolute("/favicon.ico", baseUrl),
    siteName: cleanText(meta.get("og:site_name") ?? meta.get("application-name"), 120),
  };
}
