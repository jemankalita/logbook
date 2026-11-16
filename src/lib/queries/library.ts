import { and, asc, count, desc, eq, ilike, inArray, isNull, or, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import { folders, items, itemTags, tags } from "@/db/schema";
import { likePattern } from "@/lib/actions";

export type Item = typeof items.$inferSelect;
export type Folder = typeof folders.$inferSelect;

export interface FolderNode extends Folder {
  /** links directly in this folder */
  count: number;
  /** links in this folder and all sub-folders */
  total: number;
  children: FolderNode[];
  depth: number;
}

export const ITEM_STATUSES = ["unread", "read", "done"] as const;
export const ITEM_TYPES = ["article", "course", "video", "tool", "idea", "note", "tweet", "other"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export function buildFolderTree(rows: Folder[], counts: ReadonlyMap<string | null, number>): FolderNode[] {
  const nodes = new Map<string, FolderNode>(rows.map((r) => [r.id, { ...r, count: counts.get(r.id) ?? 0, total: 0, children: [], depth: 0 }]));
  const roots: FolderNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const finish = (list: FolderNode[], depth: number): number =>
    list.reduce((sum, n) => {
      n.depth = depth;
      n.total = n.count + finish(n.children, depth + 1);
      return sum + n.total;
    }, 0);
  finish(roots, 0);
  return roots;
}

/** Folders as a tree, sorted by position then name, with link counts. */
export async function getFolderTree(): Promise<FolderNode[]> {
  const db = await getDb();
  const [rows, counts] = await Promise.all([
    db.select().from(folders).orderBy(asc(folders.position), asc(folders.name)),
    db.select({ folderId: items.folderId, n: count() }).from(items).where(eq(items.kind, "link")).groupBy(items.folderId),
  ]);
  return buildFolderTree(rows, new Map(counts.map((c) => [c.folderId, Number(c.n)])));
}

export function flattenTree(nodes: FolderNode[]): FolderNode[] {
  return nodes.flatMap((n) => [n, ...flattenTree(n.children)]);
}

/** ids of a folder and all its descendants. */
export function descendantIds(tree: FolderNode[], id: string): string[] {
  const node = flattenTree(tree).find((n) => n.id === id);
  return node ? flattenTree([node]).map((n) => n.id) : [];
}

export function folderBreadcrumbs(tree: FolderNode[], id: string): FolderNode[] {
  const all = new Map(flattenTree(tree).map((n) => [n.id, n]));
  const trail: FolderNode[] = [];
  let cur = all.get(id);
  while (cur && trail.length < 50) {
    trail.unshift(cur);
    cur = cur.parentId ? all.get(cur.parentId) : undefined;
  }
  return trail;
}

export interface ItemFilter {
  /** folder ids to include (a folder and its sub-folders); "unsorted" = no folder */
  folderIds?: string[] | "unsorted";
  q?: string;
  status?: ItemStatus;
  type?: string;
  starred?: boolean;
  kind?: "link" | "note";
  limit?: number;
  offset?: number;
}

export function itemSearchCondition(q: string): SQL | undefined {
  const p = likePattern(q.trim());
  return or(ilike(items.title, p), ilike(items.url, p), ilike(items.description, p), ilike(items.summary, p), ilike(items.bodyText, p));
}

export async function listItems(filter: ItemFilter): Promise<{ rows: Item[]; total: number }> {
  const db = await getDb();
  const conds: (SQL | undefined)[] = [eq(items.kind, filter.kind ?? "link")];
  if (filter.folderIds === "unsorted") conds.push(isNull(items.folderId));
  else if (filter.folderIds?.length) conds.push(inArray(items.folderId, filter.folderIds));
  if (filter.q?.trim()) conds.push(itemSearchCondition(filter.q));
  if (filter.status) conds.push(eq(items.status, filter.status));
  if (filter.type && (ITEM_TYPES as readonly string[]).includes(filter.type)) conds.push(eq(items.type, filter.type as Item["type"]));
  if (filter.starred) conds.push(eq(items.starred, true));
  const where = and(...conds);

  const [rows, totals] = await Promise.all([
    db
      .select()
      .from(items)
      .where(where)
      .orderBy(desc(items.createdAt))
      .limit(filter.limit ?? 60)
      .offset(filter.offset ?? 0),
    db.select({ n: count() }).from(items).where(where),
  ]);
  return { rows, total: Number(totals[0]?.n ?? 0) };
}

export async function getItem(id: string): Promise<(Item & { tags: string[] }) | null> {
  const db = await getDb();
  const [row] = await db.select().from(items).where(eq(items.id, id)).limit(1);
  if (!row) return null;
  const tagRows = await db
    .select({ name: tags.name })
    .from(itemTags)
    .innerJoin(tags, eq(tags.id, itemTags.tagId))
    .where(eq(itemTags.itemId, id))
    .orderBy(asc(tags.name));
  return { ...row, tags: tagRows.map((t) => t.name) };
}

export async function findItemByUrl(url: string): Promise<Pick<Item, "id" | "title"> | null> {
  const db = await getDb();
  const [row] = await db.select({ id: items.id, title: items.title }).from(items).where(eq(items.url, url)).limit(1);
  return row ?? null;
}

export async function recentLinks(limit = 6): Promise<Item[]> {
  const db = await getDb();
  return db.select().from(items).where(eq(items.kind, "link")).orderBy(desc(items.createdAt)).limit(limit);
}

export async function libraryCounts(): Promise<{ links: number; unread: number; starred: number; unsorted: number }> {
  const db = await getDb();
  const link = eq(items.kind, "link");
  const n = async (where: SQL | undefined) => Number((await db.select({ n: count() }).from(items).where(where))[0]?.n ?? 0);
  const [links, unread, starred, unsorted] = await Promise.all([
    n(link),
    n(and(link, eq(items.status, "unread"))),
    n(and(link, eq(items.starred, true))),
    n(and(link, isNull(items.folderId))),
  ]);
  return { links, unread, starred, unsorted };
}
