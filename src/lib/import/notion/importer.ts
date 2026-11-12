/**
 * One-time Notion → Logbook migration.
 *
 * discoverSources() walks a root page and proposes what each database / sub-page becomes.
 * importChunk() imports one slice of one source (≤ a page of rows, or one whole page), so each
 * server-action call stays short and the run can resume. Every imported Notion id is recorded
 * in import_map, so running it again skips what's already there.
 */
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Db } from "@/db/client";
import { attendance, folders, importMap, items, itemTags, journal, listEntries, lists, opportunities, paths, tags, taskCompletions, tasks, timeBlocks } from "@/db/schema";
import { dayInTimezone, isDay } from "@/lib/dates";
import { docToText, isDoc, type DocNode } from "@/lib/rich-text";
import type { NotionApi } from "./client";
import {
  blocksToDoc,
  blocksToEntries,
  classifyDatabase,
  classifyPage,
  cleanTitle,
  DATABASE_KINDS,
  dayOf,
  effortOf,
  isDateTime,
  toInstant,
  itemTypeOf,
  oppStatusOf,
  oppTypeOf,
  pick,
  plainText,
  priorityOf,
  readRow,
  rowUrl,
  tagsOf,
  taskStatusOf,
  type NotionBlock,
  type NotionPage,
  type NotionRichText,
  type RowValues,
  type SourceKind,
} from "./convert";

export const IMPORT_SOURCE = "notion";
const ROWS_PER_CHUNK = 25;
/** Rows whose page body we also read: fewer per call so each call stays well under a minute. */
const ROWS_PER_CHUNK_WITH_BODY = 10;
const ROW_BODY_REQUESTS = 6;
const PAGE_BODY_REQUESTS = 60;
const DEFAULT_BLOCK_MINUTES = 60;
const ROOT_SCAN_REQUESTS = 40;
const PAGE_SCAN_REQUESTS = 10;
const NOTES_FOLDER = "Notion pages";

export interface NotionSource {
  id: string;
  title: string;
  kind: SourceKind;
  isDatabase: boolean;
  /** For databases inside a sub-page: that page's title (becomes the parent Library folder). */
  parent: string | null;
}

export interface ChunkResult {
  added: number;
  skipped: number;
  /** Rows that errored; they aren't marked imported, so a later run retries them. */
  failed: number;
  nextCursor: string | null;
}

export interface Discovery {
  sources: NotionSource[];
  /** True when a page was too long to read fully, so some databases/pages may be missing. */
  truncated: boolean;
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Written = { entity: string; entityId: string } | null;
type Writer = (tx: Tx, page: NotionPage, row: RowValues, blocks: NotionBlock[], ctx: WriteContext) => Promise<Written>;

interface WriteContext {
  timeZone: string;
  folderId: string | null;
}

/* ── Discovery ──────────────────────────────────────────── */

const titleOf = (b: NotionBlock) => ((b[b.type] as { title?: string } | undefined)?.title ?? "").trim();
const richOf = (b: NotionBlock) => plainText((b[b.type] as { rich_text?: NotionRichText[] } | undefined)?.rich_text);

function findDatabases(blocks: NotionBlock[], out: NotionBlock[] = []): NotionBlock[] {
  for (const b of blocks) {
    if (b.type === "child_database") out.push(b);
    if (b.children?.length) findDatabases(b.children, out);
  }
  return out;
}

export async function discoverSources(api: NotionApi, rootId: string): Promise<Discovery> {
  const sources: NotionSource[] = [];
  const seen = new Set<string>();
  let truncated = false;
  const onTruncated = () => {
    truncated = true;
  };
  const add = (s: NotionSource) => {
    if (seen.has(s.id)) return;
    seen.add(s.id);
    sources.push(s);
  };

  let heading = "";
  const pages: { id: string; title: string }[] = [];
  const walk = (blocks: NotionBlock[]) => {
    for (const b of blocks) {
      if (/^heading_[123]$/.test(b.type)) heading = richOf(b);
      if (b.type === "child_database") {
        const title = titleOf(b) || "Untitled database";
        add({ id: b.id, title, kind: classifyDatabase(title), isDatabase: true, parent: null });
      } else if (b.type === "child_page") {
        const title = titleOf(b) || "Untitled page";
        add({ id: b.id, title, kind: classifyPage(title, heading), isDatabase: false, parent: null });
        pages.push({ id: b.id, title });
      }
      if (b.children?.length) walk(b.children);
    }
  };
  walk(await api.blocks(rootId, { deep: true, maxRequests: ROOT_SCAN_REQUESTS, onTruncated }));

  // Databases inside a sub-page (e.g. a research tracker) become Library folders under that page's name.
  for (const p of pages) {
    for (const b of findDatabases(await api.blocks(p.id, { deep: true, maxRequests: PAGE_SCAN_REQUESTS, onTruncated }))) {
      const title = titleOf(b) || "Untitled database";
      const kind = classifyDatabase(title);
      add({ id: b.id, title, kind, isDatabase: true, parent: kind === "library" ? cleanTitle(p.title) : null });
    }
  }
  return { sources, truncated };
}

/* ── Shared write helpers ───────────────────────────────── */

async function alreadyImported(db: Db, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const rows = await db
    .select({ id: importMap.externalId })
    .from(importMap)
    .where(and(eq(importMap.source, IMPORT_SOURCE), inArray(importMap.externalId, ids)));
  return new Set(rows.map((r) => r.id));
}

async function remember(tx: Tx, externalId: string, entity: string, entityId: string) {
  await tx.insert(importMap).values({ source: IMPORT_SOURCE, externalId, entity, entityId }).onConflictDoNothing();
}

async function folderFor(db: Db | Tx, name: string, parentId: string | null): Promise<string> {
  const [found] = await db
    .select({ id: folders.id })
    .from(folders)
    .where(and(eq(folders.name, name), parentId ? eq(folders.parentId, parentId) : isNull(folders.parentId)))
    .limit(1);
  if (found) return found.id;
  const [created] = await db.insert(folders).values({ name, parentId }).returning({ id: folders.id });
  return created.id;
}

async function attachTags(tx: Tx, itemId: string, names: string[]) {
  if (!names.length) return;
  await tx.insert(tags).values(names.map((name) => ({ name }))).onConflictDoNothing();
  const rows = await tx.select({ id: tags.id }).from(tags).where(inArray(tags.name, names));
  await tx.insert(itemTags).values(rows.map((r) => ({ itemId, tagId: r.id }))).onConflictDoNothing();
}

function docOrNull(blocks: NotionBlock[]): { body: DocNode | null; text: string } {
  if (!blocks.length) return { body: null, text: "" };
  const body = blocksToDoc(blocks);
  const text = docToText(body);
  return text ? { body, text } : { body: null, text: "" };
}

const clip = (s: string | null | undefined, n: number) => (s ? s.slice(0, n) : null);
const dateOf = (iso: string) => new Date(iso);

/* ── Database row writers ───────────────────────────────── */

const writeLibraryRow: Writer = async (tx, page, row, blocks, ctx) => {
  const url = rowUrl(row, "link", "url", "source");
  const title = clip(row.title || url || "Untitled", 500)!;
  if (url) {
    // Already saved (e.g. from the Chrome import) — link the Notion row to it instead of duplicating.
    const [existing] = await tx.select({ id: items.id }).from(items).where(eq(items.url, url)).limit(1);
    if (existing) return { entity: "item", entityId: existing.id };
  }
  const { body, text } = docOrNull(blocks);
  const summary = pick(row.texts, "summary", "notes", "note", "description", "why") ?? (Object.values(row.texts).join("\n") || null);
  const [created] = await tx
    .insert(items)
    .values({
      kind: url ? "link" : "note",
      type: itemTypeOf(row.selects.type?.[0], url),
      folderId: ctx.folderId,
      url,
      title,
      summary: clip(summary, 5_000),
      body,
      bodyText: text || null,
      actionable: pick(row.checks, "actionable", "todo", "to do") ?? false,
      starred: pick(row.checks, "starred", "favourite", "favorite", "star") ?? false,
      deadline: dayOf(pick(row.dates, "deadline", "due", "due date", "date")?.start),
      source: IMPORT_SOURCE,
      createdAt: dateOf(page.created_time),
      updatedAt: dateOf(page.last_edited_time),
    })
    .returning({ id: items.id });
  await attachTags(tx, created.id, tagsOf(row, ["type", "status"]));
  return { entity: "item", entityId: created.id };
};

const taskWriter =
  (horizon: "daily" | "upcoming"): Writer =>
  async (tx, page, row, _blocks, ctx) => {
    if (!row.title) return null;
    const status = taskStatusOf(pick(row.selects, "status", "state")?.[0]);
    const doneAt = status === "done" ? dateOf(page.last_edited_time) : null;
    const [created] = await tx
      .insert(tasks)
      .values({
        title: clip(row.title, 500)!,
        description: clip(pick(row.texts, "description", "notes", "details"), 5_000),
        horizon,
        status,
        priority: priorityOf(pick(row.selects, "priority")?.[0]),
        effort: effortOf(pick(row.selects, "effort level", "effort", "size")?.[0]),
        area: clip(pick(row.selects, "area", "category", "project")?.[0], 60),
        dueDate: dayOf(pick(row.dates, "due date", "due", "deadline", "date")?.start),
        doneAt,
        createdAt: dateOf(page.created_time),
      })
      .returning({ id: tasks.id });
    // Completed tasks count toward the tasks heatmap on the day they were finished.
    if (doneAt) await tx.insert(taskCompletions).values({ taskId: created.id, day: dayInTimezone(doneAt, ctx.timeZone) }).onConflictDoNothing();
    return { entity: "task", entityId: created.id };
  };

const writeTimeBlock: Writer = async (tx, _page, row, _blocks, ctx) => {
  const when = pick(row.dates, "when", "time", "date", "slot") ?? Object.values(row.dates)[0];
  if (!when || !isDateTime(when.start)) return null; // all-day entries have no time slot to place
  const zone = when.timeZone ?? ctx.timeZone;
  const startsAt = toInstant(when.start, zone);
  if (!startsAt) throw new Error(`Unreadable time “${when.start}”.`);
  let endsAt = when.end && isDateTime(when.end) ? toInstant(when.end, zone) : null;
  if (!endsAt || endsAt <= startsAt) endsAt = new Date(startsAt.getTime() + DEFAULT_BLOCK_MINUTES * 60_000);
  const task = pick(row.texts, "task");
  const notes = [task, pick(row.texts, "notes", "note")].filter(Boolean).join("\n");
  const [created] = await tx
    .insert(timeBlocks)
    .values({
      title: clip(row.title || task || "Block", 200)!,
      area: clip(pick(row.selects, "area", "category")?.[0], 60),
      startsAt,
      endsAt,
      done: pick(row.checks, "done", "completed") ?? false,
      notes: notes || null,
    })
    .returning({ id: timeBlocks.id });
  return { entity: "time_block", entityId: created.id };
};

const NEXT_ACTION_KEYS = ["next action", "next step", "next"];

const writeOpportunity: Writer = async (tx, page, row, blocks) => {
  if (!row.title) return null;
  const extra = Object.entries(row.texts)
    .filter(([k]) => !NEXT_ACTION_KEYS.includes(k))
    .map(([k, v]) => `${k}: ${v}`);
  const notes = [...extra, docOrNull(blocks).text].filter(Boolean).join("\n\n");
  const [created] = await tx
    .insert(opportunities)
    .values({
      name: clip(row.title, 300)!,
      type: oppTypeOf(pick(row.selects, "type", "category")?.[0]),
      status: oppStatusOf(pick(row.selects, "status", "stage")?.[0]),
      link: rowUrl(row, "link", "url", "website"),
      deadline: dayOf(pick(row.dates, "deadline", "due", "date")?.start),
      nextAction: clip(pick(row.texts, ...NEXT_ACTION_KEYS), 500),
      notes: clip(notes, 20_000) || null,
      createdAt: dateOf(page.created_time),
    })
    .returning({ id: opportunities.id });
  return { entity: "opportunity", entityId: created.id };
};

const writeJournal: Writer = async (tx, page, row, blocks, ctx) => {
  const dated = pick(row.dates, "date", "day", "when") ?? Object.values(row.dates)[0];
  const day = dayOf(dated?.start) ?? (isDay(row.title) ? row.title : dayInTimezone(dateOf(page.created_time), ctx.timeZone));
  // Text properties first ("Wins: …"), then the page body.
  const propParas: NotionBlock[] = Object.entries(row.texts).map(([k, v], i) => ({
    id: `${page.id}-p${i}`,
    type: "paragraph",
    paragraph: { rich_text: [{ plain_text: `${k[0].toUpperCase()}${k.slice(1)}: `, annotations: { bold: true } }, { plain_text: v }] },
  }));
  const { body, text } = docOrNull([...propParas, ...blocks]);
  const moodValue = pick(row.numbers, "mood", "energy", "rating");
  const mood = moodValue && Number.isInteger(moodValue) && moodValue >= 1 && moodValue <= 5 ? moodValue : null;

  const [existing] = await tx.select({ body: journal.body, text: journal.bodyText, mood: journal.mood }).from(journal).where(eq(journal.day, day)).limit(1);
  if (!existing) {
    await tx.insert(journal).values({ day, body, bodyText: text || null, mood });
  } else if (text || (mood && !existing.mood)) {
    // Several Notion rows (or an entry you already wrote) on the same day: append, never overwrite.
    const merged = existing.text && body && isDoc(existing.body) ? { type: "doc", content: [...(existing.body.content ?? []), { type: "horizontalRule" }, ...(body.content ?? [])] } : (body ?? existing.body);
    const mergedText = [existing.text, text].filter(Boolean).join("\n\n") || null;
    await tx
      .update(journal)
      .set({ body: merged, bodyText: mergedText, mood: existing.mood ?? mood })
      .where(eq(journal.day, day));
  }
  // A logged day is a day you showed up.
  await tx.insert(attendance).values({ day, checkedInAt: dateOf(page.created_time), note: "Imported from Notion" }).onConflictDoNothing();
  return { entity: "journal", entityId: day };
};

const ROW_WRITERS: Partial<Record<SourceKind, Writer>> = {
  library: writeLibraryRow,
  tasks_daily: taskWriter("daily"),
  tasks_upcoming: taskWriter("upcoming"),
  timetable: writeTimeBlock,
  opportunities: writeOpportunity,
  journal: writeJournal,
};
const NEEDS_BODY = new Set<SourceKind>(["library", "opportunities", "journal"]);

/* ── Page writers ───────────────────────────────────────── */

async function writePage(tx: Tx, source: NotionSource, blocks: NotionBlock[], emoji: string | null, notesFolder: string | null): Promise<{ entity: string; entityId: string; entries: number }> {
  const name = clip(cleanTitle(source.title), 200)!;
  const { body, text } = docOrNull(blocks);
  if (source.kind === "path") {
    const [p] = await tx.insert(paths).values({ name, emoji, body, bodyText: text || null }).returning({ id: paths.id });
    return { entity: "path", entityId: p.id, entries: 0 };
  }
  if (source.kind === "watchlist" || source.kind === "people") {
    const [l] = await tx.insert(lists).values({ name, emoji, kind: source.kind }).returning({ id: lists.id });
    const entries = blocksToEntries(blocks);
    if (entries.length) {
      await tx.insert(listEntries).values(entries.map((e, i) => ({ listId: l.id, title: e.title, url: e.url, status: e.done ? ("done" as const) : ("todo" as const), position: i })));
    }
    return { entity: "list", entityId: l.id, entries: entries.length };
  }
  const [n] = await tx
    .insert(items)
    .values({ kind: "note", type: "note", folderId: notesFolder, title: name, body, bodyText: text || null, source: IMPORT_SOURCE })
    .returning({ id: items.id });
  return { entity: "item", entityId: n.id, entries: 0 };
}

/* ── Chunks ─────────────────────────────────────────────── */

async function importDatabaseChunk(db: Db, api: NotionApi, source: NotionSource, cursor: string | null, timeZone: string): Promise<ChunkResult> {
  const writer = ROW_WRITERS[source.kind];
  if (!writer) return { added: 0, skipped: 0, failed: 0, nextCursor: null };
  const withBody = NEEDS_BODY.has(source.kind);
  const { results, nextCursor } = await api.queryDatabase(source.id, cursor, withBody ? ROWS_PER_CHUNK_WITH_BODY : ROWS_PER_CHUNK);
  const done = await alreadyImported(
    db,
    results.map((r) => r.id),
  );
  const todo = results.filter((r) => !done.has(r.id));

  // Read from Notion first, then write everything in one short transaction.
  const bodies = new Map<string, NotionBlock[]>();
  if (withBody) for (const r of todo) bodies.set(r.id, await api.blocks(r.id, { maxRequests: ROW_BODY_REQUESTS }));

  let folderId: string | null = null;
  if (source.kind === "library" && todo.length) {
    const parentId = source.parent ? await folderFor(db, source.parent, null) : null;
    folderId = await folderFor(db, cleanTitle(source.title), parentId);
  }

  let added = 0;
  let skipped = done.size;
  let failed = 0;
  await db.transaction(async (tx) => {
    for (const page of todo) {
      // Each row in its own savepoint: one bad row is rolled back alone and reported, not retried forever.
      try {
        const written = await tx.transaction(async (sp) => {
          const res = await writer(sp, page, readRow(page), bodies.get(page.id) ?? [], { timeZone, folderId });
          if (res) await remember(sp, page.id, res.entity, res.entityId);
          return res;
        });
        if (written) added++;
        else skipped++;
      } catch (err) {
        failed++;
        console.error(`[notion] row ${page.id} in “${source.title}” failed`, err);
      }
    }
  });
  return { added, skipped, failed, nextCursor };
}

async function importPage(db: Db, api: NotionApi, source: NotionSource): Promise<ChunkResult> {
  if ((await alreadyImported(db, [source.id])).size) return { added: 0, skipped: 1, failed: 0, nextCursor: null };
  const blocks = await api.blocks(source.id, { maxRequests: PAGE_BODY_REQUESTS });
  let emoji: string | null = null;
  try {
    const page = await api.page(source.id);
    emoji = page.icon?.type === "emoji" ? (page.icon.emoji ?? null) : null;
  } catch {
    // The icon is cosmetic — import without it.
  }
  const notesFolder = source.kind === "note" ? await folderFor(db, NOTES_FOLDER, null) : null;
  let added = 0;
  await db.transaction(async (tx) => {
    const res = await writePage(tx, source, blocks, emoji, notesFolder);
    await remember(tx, source.id, res.entity, res.entityId);
    added = 1 + res.entries;
  });
  return { added, skipped: 0, failed: 0, nextCursor: null };
}

export async function importChunk(db: Db, api: NotionApi, source: NotionSource, cursor: string | null, timeZone: string): Promise<ChunkResult> {
  if (source.kind === "skip") return { added: 0, skipped: 0, failed: 0, nextCursor: null };
  const isDatabaseKind = DATABASE_KINDS.includes(source.kind);
  if (source.isDatabase !== isDatabaseKind) {
    throw new Error(`“${source.title}” is a ${source.isDatabase ? "database" : "page"} — pick a ${source.isDatabase ? "database" : "page"} type for it.`);
  }
  return source.isDatabase ? importDatabaseChunk(db, api, source, cursor, timeZone) : importPage(db, api, source);
}
