import { desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { folders, items, itemTags, paths, tags, tasks } from "@/db/schema";
import { buildGraph, type GraphData } from "@/lib/graph";

/** Cap on link nodes so a few thousand imported bookmarks don't swamp the graph. */
export const MAX_LINK_NODES = 600;
const TAG_QUERY_CHUNK = 2_000;

/**
 * Every link href inside a note's editor document, extracted by Postgres (jsonpath) so the
 * full note bodies never leave the database just to draw the graph.
 */
const noteLinksSql = sql<string[] | null>`jsonb_path_query_array(${items.body}, 'lax $.**.marks[*] ? (@.type == "link").attrs.href')`;

export async function getGraph(includeAllLinks: boolean): Promise<GraphData & { hiddenLinks: number }> {
  const db = await getDb();
  const [folderRows, notes, links, pathRows, taskRows] = await Promise.all([
    db.select({ id: folders.id, name: folders.name, parentId: folders.parentId }).from(folders),
    db.select({ id: items.id, title: items.title, url: items.url, folderId: items.folderId, links: noteLinksSql }).from(items).where(eq(items.kind, "note")),
    db
      .select({ id: items.id, title: items.title, url: items.url, folderId: items.folderId })
      .from(items)
      .where(eq(items.kind, "link"))
      .orderBy(desc(items.starred), desc(items.updatedAt)),
    db.select({ id: paths.id, name: paths.name }).from(paths),
    db.select({ id: tasks.id, title: tasks.title, pathId: tasks.pathId }).from(tasks).where(isNotNull(tasks.pathId)),
  ]);

  const noteLinks = notes.map((n) => ({ ...n, links: [...new Set((n.links ?? []).filter((h): h is string => typeof h === "string"))] }));
  const referenced = new Set(noteLinks.flatMap((n) => n.links));
  // Always keep links that a note points at; fill the rest of the budget with starred, then recent.
  const limit = includeAllLinks ? Infinity : MAX_LINK_NODES;
  const keptLinks = [...links.filter((l) => l.url && referenced.has(l.url)), ...links.filter((l) => !(l.url && referenced.has(l.url)))].slice(0, limit);

  const keptIds = [...keptLinks.map((l) => l.id), ...notes.map((n) => n.id)];
  const tagRows: { itemId: string; name: string }[] = [];
  for (let i = 0; i < keptIds.length; i += TAG_QUERY_CHUNK) {
    tagRows.push(
      ...(await db
        .select({ itemId: itemTags.itemId, name: tags.name })
        .from(itemTags)
        .innerJoin(tags, eq(tags.id, itemTags.tagId))
        .where(inArray(itemTags.itemId, keptIds.slice(i, i + TAG_QUERY_CHUNK)))),
    );
  }

  const graph = buildGraph({
    folders: folderRows,
    items: [
      ...keptLinks.map((l) => ({ id: l.id, kind: "link" as const, title: l.title, url: l.url, folderId: l.folderId, links: [] })),
      ...noteLinks.map((n) => ({ id: n.id, kind: "note" as const, title: n.title, url: n.url, folderId: n.folderId, links: n.links })),
    ],
    tags: tagRows,
    paths: pathRows,
    tasks: taskRows,
  });
  return { ...graph, hiddenLinks: links.length - keptLinks.length };
}
