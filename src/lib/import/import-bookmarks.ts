import { and, eq, isNotNull, isNull } from "drizzle-orm";
import type { Db } from "@/db/client";
import { folders, items } from "@/db/schema";
import { detectType } from "@/lib/url";
import type { BookmarkNode } from "./chrome-bookmarks";

export interface ImportResult {
  foldersCreated: number;
  linksAdded: number;
  duplicates: number;
}

const INSERT_CHUNK = 400;

/**
 * Write a parsed bookmark tree into the Library. Safe to run again:
 * folders are matched by (parent, name) and links already saved (same URL) are skipped.
 */
export async function importBookmarkTree(db: Db, nodes: BookmarkNode[]): Promise<ImportResult> {
  return db.transaction(async (tx) => {
    const existingUrls = new Set(
      (await tx.select({ url: items.url }).from(items).where(isNotNull(items.url))).map((r) => r.url as string),
    );
    const result: ImportResult = { foldersCreated: 0, linksAdded: 0, duplicates: 0 };
    const pending: (typeof items.$inferInsert)[] = [];

    async function folderId(name: string, parentId: string | null, position: number): Promise<string> {
      const [found] = await tx
        .select({ id: folders.id })
        .from(folders)
        .where(and(eq(folders.name, name), parentId ? eq(folders.parentId, parentId) : isNull(folders.parentId)))
        .limit(1);
      if (found) return found.id;
      const [created] = await tx.insert(folders).values({ name, parentId, position }).returning({ id: folders.id });
      result.foldersCreated++;
      return created.id;
    }

    async function walk(list: BookmarkNode[], parentId: string | null): Promise<void> {
      let position = 0;
      for (const node of list) {
        if (node.type === "folder") {
          const id = await folderId(node.name.slice(0, 200), parentId, position++);
          await walk(node.children, id);
          continue;
        }
        if (existingUrls.has(node.url)) {
          result.duplicates++;
          continue;
        }
        existingUrls.add(node.url);
        pending.push({
          folderId: parentId,
          kind: "link",
          type: detectType(node.url),
          url: node.url,
          title: node.title.slice(0, 500),
          favicon: node.icon,
          source: "chrome",
          ...(node.addedAt ? { createdAt: node.addedAt, updatedAt: node.addedAt } : {}),
        });
      }
    }

    await walk(nodes, null);
    for (let i = 0; i < pending.length; i += INSERT_CHUNK) {
      await tx.insert(items).values(pending.slice(i, i + INSERT_CHUNK));
    }
    result.linksAdded = pending.length;
    return result;
  });
}
