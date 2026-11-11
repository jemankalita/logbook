/** Builds the knowledge graph from plain records. Pure — the query layer feeds it. */

export type GraphKind = "folder" | "link" | "note" | "tag" | "path" | "task";

export interface GraphNode {
  id: string;
  label: string;
  kind: GraphKind;
  href: string | null;
  /** number of connections (filled in by buildGraph) */
  degree: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphInput {
  folders: { id: string; name: string; parentId: string | null }[];
  items: { id: string; kind: "link" | "note" | "list_item" | "person"; title: string; url: string | null; folderId: string | null; links: string[] }[];
  tags: { itemId: string; name: string }[];
  paths: { id: string; name: string }[];
  tasks: { id: string; title: string; pathId: string | null }[];
}

export const KIND_ORDER: GraphKind[] = ["folder", "link", "note", "tag", "path", "task"];

/** "/notes/<uuid>" or "/library/<uuid>" → uuid (also works for absolute URLs to this app). */
function internalId(href: string): string | null {
  const m = /\/(?:notes|library)\/([0-9a-f-]{36})(?:[/?#]|$)/i.exec(href);
  return m ? m[1].toLowerCase() : null;
}

export function buildGraph(input: GraphInput): GraphData {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const seenEdge = new Set<string>();
  const add = (id: string, label: string, kind: GraphKind, href: string | null) => {
    if (!nodes.has(id)) nodes.set(id, { id, label, kind, href, degree: 0 });
  };
  const connect = (a: string, b: string) => {
    if (a === b || !nodes.has(a) || !nodes.has(b)) return;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seenEdge.has(key)) return;
    seenEdge.add(key);
    edges.push({ source: a, target: b });
  };

  for (const f of input.folders) add(`folder:${f.id}`, f.name, "folder", `/library?folder=${f.id}`);
  for (const f of input.folders) if (f.parentId) connect(`folder:${f.id}`, `folder:${f.parentId}`);

  const byUrl = new Map<string, string>();
  for (const it of input.items) {
    if (it.kind !== "link" && it.kind !== "note") continue;
    add(`item:${it.id}`, it.title, it.kind, it.kind === "note" ? `/notes/${it.id}` : `/library/${it.id}`);
    if (it.url) byUrl.set(it.url, `item:${it.id}`);
  }
  for (const it of input.items) {
    const self = `item:${it.id}`;
    if (it.folderId) connect(self, `folder:${it.folderId}`);
    for (const href of it.links) {
      const target = internalId(href) ? `item:${internalId(href)}` : byUrl.get(href);
      if (target) connect(self, target);
    }
  }

  for (const t of input.tags) {
    add(`tag:${t.name}`, `#${t.name}`, "tag", null);
    connect(`item:${t.itemId}`, `tag:${t.name}`);
  }

  for (const p of input.paths) add(`path:${p.id}`, p.name, "path", `/paths/${p.id}`);
  for (const t of input.tasks) {
    if (!t.pathId) continue;
    add(`task:${t.id}`, t.title, "task", `/paths/${t.pathId}`);
    connect(`task:${t.id}`, `path:${t.pathId}`);
  }

  for (const e of edges) {
    nodes.get(e.source)!.degree++;
    nodes.get(e.target)!.degree++;
  }
  // Drop orphan tags (all their items were filtered out).
  const list = [...nodes.values()].filter((n) => n.kind !== "tag" || n.degree > 0);
  return { nodes: list, edges };
}
