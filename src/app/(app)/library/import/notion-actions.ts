"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import { requireSession } from "@/lib/auth/require-session";
import { appTimezone } from "@/lib/dates";
import { createNotionClient, NotionError } from "@/lib/import/notion/client";
import { notionIdFrom, SOURCE_KINDS } from "@/lib/import/notion/convert";
import { discoverSources, importChunk, type NotionSource } from "@/lib/import/notion/importer";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

const NOTION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sourceSchema = z.object({
  id: z.string().regex(NOTION_ID),
  title: z.string().max(500),
  kind: z.enum(SOURCE_KINDS),
  isDatabase: z.boolean(),
  parent: z.string().max(500).nullable(),
});
const cursorSchema = z.string().max(500).nullable();

function config(): { token: string; rootId: string } | string {
  const token = process.env.NOTION_TOKEN?.trim();
  const rootId = notionIdFrom(process.env.NOTION_ROOT_PAGE);
  if (!token) return "Add NOTION_TOKEN to your environment (see the steps above), then restart the app.";
  if (!rootId) return "Add NOTION_ROOT_PAGE (the link to your top Notion page) to your environment, then restart the app.";
  return { token, rootId };
}

function explain(err: unknown): string {
  if (err instanceof NotionError) {
    if (err.status === 401) return "Notion rejected the token. Check NOTION_TOKEN.";
    if (err.status === 404) return "Notion can't see that page. In Notion open it → ⋯ → Connections → add your Logbook integration.";
    if (err.status === 429) return "Notion is rate-limiting us. Wait a minute and press Continue.";
    return `Notion error: ${err.message}`;
  }
  if (err instanceof Error && err.name === "TimeoutError") return "Notion took too long to answer. Press Continue to retry.";
  return err instanceof Error ? err.message : "Something went wrong.";
}

export async function scanNotion(): Promise<Result<{ sources: NotionSource[]; truncated: boolean }>> {
  await requireSession();
  const cfg = config();
  if (typeof cfg === "string") return { ok: false, error: cfg };
  try {
    const { sources, truncated } = await discoverSources(createNotionClient(cfg.token), cfg.rootId);
    return { ok: true, sources, truncated };
  } catch (err) {
    console.error("[notion] scan failed", err);
    return { ok: false, error: explain(err) };
  }
}

export async function importNotionChunk(rawSource: unknown, rawCursor: unknown): Promise<Result<{ added: number; skipped: number; failed: number; nextCursor: string | null }>> {
  await requireSession();
  const cfg = config();
  if (typeof cfg === "string") return { ok: false, error: cfg };
  const source = sourceSchema.safeParse(rawSource);
  const cursor = cursorSchema.safeParse(rawCursor ?? null);
  if (!source.success || !cursor.success) return { ok: false, error: "Invalid import request." };
  try {
    const res = await importChunk(await getDb(), createNotionClient(cfg.token), source.data, cursor.data, appTimezone());
    if (!res.nextCursor) revalidatePath("/", "layout");
    return { ok: true, ...res };
  } catch (err) {
    console.error("[notion] import failed", source.data.title, err);
    return { ok: false, error: explain(err) };
  }
}
