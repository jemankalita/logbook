/** Helpers for the editor's JSON documents (ProseMirror / TipTap shape). */

export interface DocNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
}

const BLOCK_TYPES = new Set(["paragraph", "heading", "listItem", "taskItem", "blockquote", "codeBlock", "horizontalRule"]);
export const MAX_DOC_JSON_CHARS = 2_000_000;

export function isDoc(value: unknown): value is DocNode {
  return typeof value === "object" && value !== null && (value as DocNode).type === "doc";
}

/** Plain text of a document, one line per block — used for search and previews. */
export function docToText(doc: unknown): string {
  if (!isDoc(doc)) return "";
  const lines: string[] = [];
  let line = "";
  const walk = (node: DocNode) => {
    if (typeof node.text === "string") line += node.text;
    if (node.type === "hardBreak") line += "\n";
    for (const child of node.content ?? []) walk(child);
    if (node.type && BLOCK_TYPES.has(node.type) && line) {
      lines.push(line);
      line = "";
    }
  };
  walk(doc);
  if (line) lines.push(line);
  return lines.join("\n").trim();
}

interface MarkNode extends DocNode {
  marks?: { type?: string; attrs?: { href?: unknown } }[];
}

/** Every link href in a document (deduplicated), for the knowledge graph. */
export function docLinks(doc: unknown): string[] {
  if (!isDoc(doc)) return [];
  const out = new Set<string>();
  const walk = (node: MarkNode) => {
    for (const m of node.marks ?? []) if (m.type === "link" && typeof m.attrs?.href === "string") out.add(m.attrs.href);
    for (const child of (node.content ?? []) as MarkNode[]) walk(child);
  };
  walk(doc);
  return [...out];
}

/** Plain text → a minimal document (paragraph per line). Used by importers. */
export function textToDoc(text: string): DocNode {
  const paragraphs = text
    .split(/\r?\n/)
    .map((l) => (l ? { type: "paragraph", content: [{ type: "text", text: l }] } : { type: "paragraph" }));
  return { type: "doc", content: paragraphs.length ? paragraphs : [{ type: "paragraph" }] };
}

/** Parse a JSON document coming from a form; rejects anything that isn't an editor doc. */
export function parseDocJson(raw: unknown): DocNode | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_DOC_JSON_CHARS) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return isDoc(value) ? value : null;
  } catch {
    return null;
  }
}

/** First n chars of a text, on one line. */
export function excerpt(text: string | null | undefined, n = 160): string {
  if (!text) return "";
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > n ? `${flat.slice(0, n - 1)}…` : flat;
}
