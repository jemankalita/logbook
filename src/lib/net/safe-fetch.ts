import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Fetch a public web page without letting a saved link reach the server's own network
 * (SSRF guard): http(s) on default ports only, every hop's address must be public,
 * redirects are followed manually and re-checked, and the body is size-capped.
 */

const MAX_REDIRECTS = 4;
const TIMEOUT_MS = 8_000;
const USER_AGENT = "Mozilla/5.0 (compatible; LogbookPreview/1.0)";

export class UnsafeUrlError extends Error {}

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => ((acc << 8) >>> 0) + Number(part), 0) >>> 0;
}

const PRIVATE_V4: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 3], // multicast + reserved
];

export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const n = ipv4ToInt(ip);
    return PRIVATE_V4.some(([base, bits]) => {
      const mask = (~0 << (32 - bits)) >>> 0;
      return ((n & mask) >>> 0) === ((ipv4ToInt(base) & mask) >>> 0);
    });
  }
  if (version === 6) {
    const lower = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped) return isPrivateAddress(mapped[1]);
    return (
      lower === "::" ||
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      /^fe[89ab]/.test(lower) ||
      lower.startsWith("ff") ||
      lower.startsWith("::ffff:")
    );
  }
  return true;
}

async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new UnsafeUrlError("Only http(s) links can be previewed.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new UnsafeUrlError("Non-standard ports aren't previewed.");
  if (url.username || url.password) throw new UnsafeUrlError("Links with credentials aren't previewed.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new UnsafeUrlError("That address points to a private network.");
  }
}

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  const merged = new Uint8Array(Math.min(total, maxBytes));
  let offset = 0;
  for (const c of chunks) {
    const slice = c.subarray(0, merged.length - offset);
    merged.set(slice, offset);
    offset += slice.length;
    if (offset >= merged.length) break;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

export interface SafeFetchResult {
  finalUrl: string;
  contentType: string;
  body: string;
}

export async function safeFetchText(input: string, maxBytes = 1_500_000): Promise<SafeFetchResult> {
  let url = new URL(input);
  const signal = AbortSignal.timeout(TIMEOUT_MS);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal,
      cache: "no-store",
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5", "accept-language": "en" },
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      await res.body?.cancel().catch(() => undefined);
      if (!location) throw new Error(`Redirect without a location (HTTP ${res.status}).`);
      url = new URL(location, url);
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel().catch(() => undefined);
      throw new Error(`The site returned HTTP ${res.status}.`);
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!/html|xml/i.test(contentType)) {
      await res.body?.cancel().catch(() => undefined);
      return { finalUrl: url.toString(), contentType, body: "" };
    }
    return { finalUrl: url.toString(), contentType, body: await readCapped(res, maxBytes) };
  }
  throw new Error("Too many redirects.");
}
