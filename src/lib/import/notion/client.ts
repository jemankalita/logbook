import type { NotionBlock, NotionPage, NotionRichText } from "./convert";

const API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const MAX_RETRIES = 4;
const REQUEST_TIMEOUT_MS = 20_000;
/** Nested blocks we follow (toggles, list children, columns, tables). */
const NESTED = new Set(["bulleted_list_item", "numbered_list_item", "to_do", "toggle", "quote", "callout", "column_list", "column", "synced_block", "table", "paragraph"]);

export class NotionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface QueryResult {
  results: NotionPage[];
  nextCursor: string | null;
}

/** The handful of Notion API calls the importer needs. Interface so tests can fake it. */
export interface NotionApi {
  databaseTitle(id: string): Promise<string>;
  queryDatabase(id: string, cursor: string | null, pageSize: number): Promise<QueryResult>;
  page(id: string): Promise<NotionPage>;
  /** All blocks of a page, nested children attached (bounded by `maxRequests`; `onTruncated` fires if that cut anything off). */
  blocks(id: string, opts?: { deep?: boolean; maxRequests?: number; onTruncated?: () => void }): Promise<NotionBlock[]>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createNotionClient(token: string, fetchImpl: typeof fetch = fetch): NotionApi {
  async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const res = await fetchImpl(`${API}${path}`, {
        method: init.method ?? "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": NOTION_VERSION,
          ...(init.body ? { "Content-Type": "application/json" } : {}),
        },
        body: init.body ? JSON.stringify(init.body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });
      if (res.ok) return (await res.json()) as T;
      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < MAX_RETRIES) {
        const retryAfter = Number(res.headers.get("retry-after"));
        await sleep(Math.min(10_000, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt));
        continue;
      }
      let message = `Notion API ${res.status}`;
      try {
        const err = (await res.json()) as { message?: string };
        if (err.message) message = err.message;
      } catch {
        // keep the status-only message
      }
      throw new NotionError(message, res.status);
    }
  }

  interface Budget {
    left: number;
    truncated: boolean;
  }

  async function children(id: string, budget: Budget, deep: boolean): Promise<NotionBlock[]> {
    const out: NotionBlock[] = [];
    let cursor: string | null = null;
    do {
      if (budget.left-- <= 0) {
        budget.truncated = true;
        break;
      }
      const qs: string = `?page_size=100${cursor ? `&start_cursor=${encodeURIComponent(cursor)}` : ""}`;
      const res: { results: NotionBlock[]; has_more: boolean; next_cursor: string | null } = await call(`/blocks/${id}/children${qs}`);
      out.push(...res.results);
      cursor = res.has_more ? res.next_cursor : null;
    } while (cursor);
    if (deep) {
      for (const b of out) {
        if (!b.has_children || !NESTED.has(b.type)) continue;
        if (budget.left <= 0) {
          budget.truncated = true;
          break;
        }
        b.children = await children(b.id, budget, true);
      }
    }
    return out;
  }

  return {
    async databaseTitle(id) {
      const db = await call<{ title?: NotionRichText[] }>(`/databases/${id}`);
      return (db.title ?? []).map((t) => t.plain_text).join("").trim();
    },
    async queryDatabase(id, cursor, pageSize) {
      const res = await call<{ results: NotionPage[]; next_cursor: string | null; has_more: boolean }>(`/databases/${id}/query`, {
        method: "POST",
        body: { page_size: pageSize, ...(cursor ? { start_cursor: cursor } : {}) },
      });
      return { results: res.results, nextCursor: res.has_more ? res.next_cursor : null };
    },
    page: (id) => call<NotionPage>(`/pages/${id}`),
    async blocks(id, opts = {}) {
      const budget: Budget = { left: opts.maxRequests ?? 40, truncated: false };
      const out = await children(id, budget, opts.deep ?? true);
      if (budget.truncated) opts.onTruncated?.();
      return out;
    },
  };
}
