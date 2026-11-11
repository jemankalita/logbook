import { getTweet } from "react-tweet/api";
import { safeFetchText } from "@/lib/net/safe-fetch";
import { detectType, hostnameOf, tweetIdFromUrl, type ItemType } from "@/lib/url";
import { cleanText, parseMeta } from "./parse-meta";

export interface LinkPreview {
  url: string;
  title: string;
  description: string | null;
  image: string | null;
  favicon: string | null;
  type: ItemType;
}

const TWEET_TITLE_CHARS = 120;

async function tweetPreview(url: string, id: string): Promise<LinkPreview> {
  const tweet = await getTweet(id, { signal: AbortSignal.timeout(8_000) });
  if (!tweet) throw new Error("That post is unavailable (deleted, private, or X is blocking previews).");
  const text = cleanText(tweet.text, 2_000) ?? "";
  const snippet = text.length > TWEET_TITLE_CHARS ? `${text.slice(0, TWEET_TITLE_CHARS - 1)}…` : text;
  return {
    url,
    title: `${tweet.user.name} (@${tweet.user.screen_name})${snippet ? `: ${snippet}` : ""}`,
    description: text || null,
    image: tweet.photos?.[0]?.url ?? tweet.mediaDetails?.[0]?.media_url_https ?? null,
    favicon: tweet.user.profile_image_url_https ?? null,
    type: "tweet",
  };
}

/** Never throws: falls back to a bare card built from the URL when the site can't be read. */
export async function fetchPreview(url: string): Promise<{ preview: LinkPreview; error?: string }> {
  const fallback: LinkPreview = { url, title: hostnameOf(url) || url, description: null, image: null, favicon: null, type: detectType(url) };
  try {
    const tweetId = tweetIdFromUrl(url);
    if (tweetId) return { preview: await tweetPreview(url, tweetId) };

    const { finalUrl, body } = await safeFetchText(url);
    if (!body) return { preview: fallback };
    const meta = parseMeta(body, finalUrl);
    return {
      preview: {
        url,
        title: meta.title ?? fallback.title,
        description: meta.description,
        image: meta.image,
        favicon: meta.favicon,
        type: detectType(url),
      },
    };
  } catch (err) {
    const reason = err instanceof Error && !/https?:\/\//.test(err.message) ? err.message : "Couldn't read that page.";
    return { preview: fallback, error: reason };
  }
}
