/** URL helpers shared by the Library, capture page and importers. */

export type ItemType = "article" | "course" | "video" | "tool" | "idea" | "note" | "tweet" | "other";

const MAX_URL_LENGTH = 4096;

/** Parse user input into an http(s) URL; adds https:// when the scheme is missing. */
export function normalizeUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw || raw.length > MAX_URL_LENGTH || /\s/.test(raw)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
  return url.toString();
}

export function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export function hostnameOf(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const TWEET_HOSTS = new Set(["twitter.com", "x.com", "mobile.twitter.com", "mobile.x.com"]);

/** "https://x.com/user/status/123" → "123" */
export function tweetIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!TWEET_HOSTS.has(u.hostname.replace(/^www\./, ""))) return null;
    const match = /^\/[^/]+\/status(?:es)?\/(\d{5,25})/.exec(u.pathname);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/** YouTube watch / share / shorts URL → video id. */
export function youtubeIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www|m)\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = u.pathname.slice(1);
    else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      id = u.searchParams.get("v") ?? /^\/(?:shorts|embed|live)\/([^/?]+)/.exec(u.pathname)?.[1] ?? null;
    }
    return id && /^[\w-]{6,20}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

const HOST_TYPES: [RegExp, ItemType][] = [
  [/(^|\.)(youtube\.com|youtu\.be|vimeo\.com|loom\.com)$/, "video"],
  [/(^|\.)(coursera\.org|udemy\.com|edx\.org|nptel\.ac\.in|khanacademy\.org|freecodecamp\.org|udacity\.com|deeplearning\.ai)$/, "course"],
  [/(^|\.)(github\.com|npmjs\.com|huggingface\.co|pypi\.org|vercel\.com|chromewebstore\.google\.com)$/, "tool"],
  [/(^|\.)(medium\.com|substack\.com|dev\.to|hashnode\.dev|wikipedia\.org|arxiv\.org)$/, "article"],
];

/** Best guess at what a link is, from its address alone. */
export function detectType(url: string | null | undefined): ItemType {
  if (!url) return "note";
  if (tweetIdFromUrl(url)) return "tweet";
  const host = hostnameOf(url);
  for (const [re, type] of HOST_TYPES) if (re.test(host)) return type;
  if (/(^|\.)blog\.|\/blog\//.test(url)) return "article";
  return "other";
}
