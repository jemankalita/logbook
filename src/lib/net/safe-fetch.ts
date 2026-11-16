import dns from "node:dns";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent, fetch as undiciFetch, type Response as UndiciResponse } from "undici";

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
  if (version === 6) return isPrivateV6(ip);
  return true;
}

/** "2002:c0a8::1" → eight 16-bit words (handles "::" and a trailing dotted IPv4). */
function ipv6Words(ip: string): number[] | null {
  let s = ip.toLowerCase().split("%")[0];
  const dotted = /(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (dotted) {
    const n = ipv4ToInt(dotted[1]);
    s = `${s.slice(0, -dotted[1].length)}${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const [head, tail] = s.split("::");
  const h = head ? head.split(":") : [];
  const t = tail === undefined ? null : tail ? tail.split(":") : [];
  const parts = t === null ? h : [...h, ...Array<string>(8 - h.length - t.length).fill("0"), ...t];
  if (parts.length !== 8) return null;
  const words = parts.map((p) => parseInt(p, 16));
  return words.every((w) => Number.isInteger(w) && w >= 0 && w <= 0xffff) ? words : null;
}

const v4FromWords = (a: number, b: number) => `${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`;
const allZero = (ws: number[]) => ws.every((w) => w === 0);

function isPrivateV6(ip: string): boolean {
  const w = ipv6Words(ip);
  if (!w) return true;
  if (allZero(w.slice(0, 7)) && w[7] <= 1) return true; // :: and ::1
  // IPv4 hidden inside IPv6: mapped (::ffff:a.b.c.d), compatible (::a.b.c.d), NAT64 (64:ff9b::/96), 6to4 (2002::/16).
  if (allZero(w.slice(0, 5)) && w[5] === 0xffff) return isPrivateAddress(v4FromWords(w[6], w[7]));
  if (allZero(w.slice(0, 6))) return isPrivateAddress(v4FromWords(w[6], w[7]));
  if (w[0] === 0x64 && w[1] === 0xff9b && allZero(w.slice(2, 6))) return isPrivateAddress(v4FromWords(w[6], w[7]));
  if (w[0] === 0x2002) return isPrivateAddress(v4FromWords(w[1], w[2]));
  return (
    (w[0] & 0xfe00) === 0xfc00 || // unique local fc00::/7
    (w[0] & 0xffc0) === 0xfe80 || // link-local fe80::/10
    (w[0] & 0xffc0) === 0xfec0 || // old site-local fec0::/10
    (w[0] & 0xff00) === 0xff00 || // multicast
    (w[0] === 0x2001 && w[1] === 0x0db8) // documentation
  );
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address?: string | dns.LookupAddress[], family?: number) => void;

/**
 * DNS lookup used for the actual socket connection. Checking the address *here* (not just
 * before fetch) closes the DNS-rebinding gap: the IP we validate is the IP we connect to.
 */
export function checkedLookup(hostname: string, options: dns.LookupOptions, callback: LookupCallback): void {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);
    const list = addresses as dns.LookupAddress[];
    if (list.length === 0 || list.some((a) => isPrivateAddress(a.address))) {
      return callback(Object.assign(new UnsafeUrlError("That address points to a private network."), { code: "EUNSAFE" }));
    }
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

let agent: Agent | null = null;
const guardedAgent = () => (agent ??= new Agent({ connect: { lookup: checkedLookup as never } }));

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

async function readCapped(res: UndiciResponse, maxBytes: number): Promise<string> {
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
    const res = await undiciFetch(url, {
      redirect: "manual",
      signal,
      dispatcher: guardedAgent(),
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
