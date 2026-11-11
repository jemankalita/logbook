"use server";

import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { folders, items, itemTags, tags } from "@/db/schema";
import { failure, firstIssue, formFields, optionalDay, optionalText, parseTags, requiredText, safeReturnPath, uuid, type ActionResult } from "@/lib/actions";
import { requireSession } from "@/lib/auth/require-session";
import { countBookmarks, isBookmarkExport, parseChromeBookmarks, topLevelNodes } from "@/lib/import/chrome-bookmarks";
import { importBookmarkTree } from "@/lib/import/import-bookmarks";
import { fetchPreview } from "@/lib/preview/fetch-preview";
import { findItemByUrl, ITEM_STATUSES, ITEM_TYPES } from "@/lib/queries/library";
import { normalizeUrl } from "@/lib/url";

const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
const ENRICH_BATCH = 12;

function refresh() {
  revalidatePath("/library", "layout");
  revalidatePath("/");
}

const folderRef = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v && uuid.safeParse(v).success ? v : null));

/* ── Saving links ──────────────────────────────────────── */

const SaveLinkInput = z.object({
  url: z.string().max(4096),
  folderId: folderRef,
  note: optionalText(5_000),
  title: optionalText(500),
});

/** Save a link with an automatic preview card. Used by the Library, ⌘K, bookmarklet, extension and share sheet. */
export async function saveLink(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireSession();
  const parsed = SaveLinkInput.safeParse(formFields(fd, ["url", "folderId", "note", "title"]));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const url = normalizeUrl(parsed.data.url);
  if (!url) return { ok: false, error: "That doesn't look like a web address." };

  try {
    const existing = await findItemByUrl(url);
    if (existing) return { ok: true, id: existing.id, message: `Already in your Library: “${existing.title}”.` };

    const { preview } = await fetchPreview(url);
    const db = await getDb();
    const [row] = await db
      .insert(items)
      .values({
        kind: "link",
        type: preview.type,
        url,
        title: parsed.data.title ?? preview.title,
        description: preview.description,
        image: preview.image,
        favicon: preview.favicon,
        summary: parsed.data.note,
        folderId: parsed.data.folderId,
        source: "web",
        previewFetchedAt: new Date(),
      })
      .returning({ id: items.id, title: items.title });
    refresh();
    return { ok: true, id: row.id, message: `Saved “${row.title}”.` };
  } catch (err) {
    return failure("saveLink", err, "Couldn't save that link. Try again.");
  }
}

/* ── Editing items ─────────────────────────────────────── */

const UpdateItemInput = z.object({
  id: uuid,
  title: requiredText(500, "Give it a title."),
  summary: optionalText(10_000),
  folderId: folderRef,
  status: z.enum(ITEM_STATUSES),
  type: z.enum(ITEM_TYPES),
  tags: z.string().max(1_000).optional(),
  deadline: optionalDay,
});

async function setItemTags(itemId: string, names: string[]): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.delete(itemTags).where(eq(itemTags.itemId, itemId));
    if (names.length === 0) return;
    await tx.insert(tags).values(names.map((name) => ({ name }))).onConflictDoNothing();
    const rows = await tx.select({ id: tags.id }).from(tags).where(inArray(tags.name, names));
    await tx.insert(itemTags).values(rows.map((r) => ({ itemId, tagId: r.id }))).onConflictDoNothing();
  });
}

export async function updateItem(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireSession();
  const parsed = UpdateItemInput.safeParse(formFields(fd, ["id", "title", "summary", "folderId", "status", "type", "tags", "deadline"]));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { id, tags: rawTags, ...fields } = parsed.data;
  try {
    const db = await getDb();
    await db.update(items).set({ ...fields, updatedAt: new Date() }).where(eq(items.id, id));
    await setItemTags(id, parseTags(rawTags));
    refresh();
    return { ok: true, message: "Saved." };
  } catch (err) {
    return failure("updateItem", err);
  }
}

export async function toggleStar(id: string): Promise<void> {
  await requireSession();
  if (!uuid.safeParse(id).success) return;
  const db = await getDb();
  const [row] = await db.select({ starred: items.starred }).from(items).where(eq(items.id, id)).limit(1);
  if (!row) return;
  await db.update(items).set({ starred: !row.starred, updatedAt: new Date() }).where(eq(items.id, id));
  refresh();
}

export async function setItemStatus(id: string, status: string): Promise<void> {
  await requireSession();
  const parsed = z.object({ id: uuid, status: z.enum(ITEM_STATUSES) }).safeParse({ id, status });
  if (!parsed.success) return;
  const db = await getDb();
  await db.update(items).set({ status: parsed.data.status, updatedAt: new Date() }).where(eq(items.id, parsed.data.id));
  refresh();
}

export async function deleteItem(id: string, returnTo: string): Promise<void> {
  await requireSession();
  if (!uuid.safeParse(id).success) return;
  const db = await getDb();
  await db.delete(items).where(eq(items.id, id));
  refresh();
  revalidatePath("/notes", "layout");
  redirect(safeReturnPath(returnTo, "/library"));
}

export async function refreshPreview(id: string): Promise<void> {
  await requireSession();
  if (!uuid.safeParse(id).success) return;
  const db = await getDb();
  const [row] = await db.select({ url: items.url }).from(items).where(eq(items.id, id)).limit(1);
  if (!row?.url) return;
  const { preview } = await fetchPreview(row.url);
  await db
    .update(items)
    .set({
      title: preview.title,
      description: preview.description,
      image: preview.image,
      favicon: preview.favicon ?? undefined,
      type: preview.type,
      previewFetchedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(items.id, id));
  refresh();
}

/* ── Folders ───────────────────────────────────────────── */

const FolderInput = z.object({
  name: requiredText(120, "Name the folder."),
  emoji: optionalText(16),
  parentId: folderRef,
});

export async function createFolder(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireSession();
  const parsed = FolderInput.safeParse(formFields(fd, ["name", "emoji", "parentId"]));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  try {
    const db = await getDb();
    const siblings = await db
      .select({ id: folders.id })
      .from(folders)
      .where(parsed.data.parentId ? eq(folders.parentId, parsed.data.parentId) : isNull(folders.parentId));
    const [row] = await db
      .insert(folders)
      .values({ ...parsed.data, position: siblings.length })
      .returning({ id: folders.id });
    refresh();
    return { ok: true, id: row.id, message: `Created “${parsed.data.name}”.` };
  } catch (err) {
    return failure("createFolder", err);
  }
}

export async function updateFolder(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireSession();
  const parsed = FolderInput.extend({ id: uuid }).safeParse(formFields(fd, ["id", "name", "emoji", "parentId"]));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { id, ...fields } = parsed.data;
  try {
    const db = await getDb();
    // Refuse to move a folder inside itself or one of its own sub-folders.
    if (fields.parentId) {
      const all = await db.select({ id: folders.id, parentId: folders.parentId }).from(folders);
      const parentOf = new Map(all.map((f) => [f.id, f.parentId]));
      let guard = 0;
      for (let cur: string | null | undefined = fields.parentId; cur && guard < 100; cur = parentOf.get(cur), guard++) {
        if (cur === id) return { ok: false, error: "A folder can't go inside itself." };
      }
    }
    await db.update(folders).set(fields).where(eq(folders.id, id));
    refresh();
    return { ok: true, message: "Folder updated." };
  } catch (err) {
    return failure("updateFolder", err);
  }
}

/** Deletes a folder and its sub-folders. Links inside are kept and become Unsorted. */
export async function deleteFolder(id: string): Promise<void> {
  await requireSession();
  if (!uuid.safeParse(id).success) return;
  const db = await getDb();
  await db.delete(folders).where(eq(folders.id, id));
  refresh();
  redirect("/library");
}

/* ── Chrome import & preview backfill ──────────────────── */

export async function importChromeBookmarks(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireSession();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose your exported bookmarks .html file." };
  if (file.size > MAX_IMPORT_BYTES) return { ok: false, error: "That file is over 20 MB." };

  const html = await file.text();
  if (!isBookmarkExport(html)) return { ok: false, error: "That isn't a Chrome bookmarks export. Use Bookmarks Manager → ⋮ → Export bookmarks." };

  const nodes = topLevelNodes(parseChromeBookmarks(html));
  if (countBookmarks(nodes).links === 0) return { ok: false, error: "No links found in that file." };

  try {
    const result = await importBookmarkTree(await getDb(), nodes);
    refresh();
    const dupes = result.duplicates ? `, skipped ${result.duplicates} already saved` : "";
    return {
      ok: true,
      message: `Imported ${result.linksAdded} links and ${result.foldersCreated} new folders${dupes}.`,
    };
  } catch (err) {
    return failure("importChromeBookmarks", err, "The import failed and was rolled back. Nothing was changed.");
  }
}

/** Fetch preview cards for a few links that don't have one yet. Called repeatedly by the import page. */
export async function enrichPreviews(): Promise<{ processed: number; remaining: number }> {
  await requireSession();
  const db = await getDb();
  const pending = and(eq(items.kind, "link"), isNull(items.previewFetchedAt));
  const batch = await db
    .select({ id: items.id, url: items.url, title: items.title, favicon: items.favicon })
    .from(items)
    .where(pending)
    .orderBy(asc(items.createdAt))
    .limit(ENRICH_BATCH);

  await Promise.all(
    batch.map(async (row) => {
      if (!row.url) {
        await db.update(items).set({ previewFetchedAt: new Date() }).where(eq(items.id, row.id));
        return;
      }
      const { preview, error } = await fetchPreview(row.url);
      await db
        .update(items)
        .set({
          // Keep the bookmark's own title: it's what you named it.
          description: preview.description,
          image: preview.image,
          favicon: row.favicon ?? preview.favicon,
          type: preview.type,
          previewFetchedAt: new Date(),
          ...(!error && row.title === row.url ? { title: preview.title } : {}),
        })
        .where(eq(items.id, row.id));
    }),
  );

  const remaining = Number((await db.select({ n: count() }).from(items).where(pending))[0]?.n ?? 0);
  if (batch.length) refresh();
  return { processed: batch.length, remaining };
}
