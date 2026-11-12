/**
 * Pure conversion helpers for the one-time Notion import: Notion blocks → editor documents,
 * database properties → plain values, and Notion option names → Logbook enums.
 * No I/O here, so everything is unit-tested.
 */
import type { DocNode } from "@/lib/rich-text";
import { normalizeUrl, detectType, type ItemType } from "@/lib/url";
import { OPP_TYPES, type OppStatus } from "@/lib/opportunity-meta";

/* ── Notion API shapes (only the parts we read) ─────────── */

export interface NotionRichText {
  plain_text: string;
  href?: string | null;
  annotations?: { bold?: boolean; italic?: boolean; strikethrough?: boolean; underline?: boolean; code?: boolean };
}

export interface NotionProperty {
  type: string;
  title?: NotionRichText[];
  rich_text?: NotionRichText[];
  url?: string | null;
  email?: string | null;
  select?: { name: string } | null;
  status?: { name: string } | null;
  multi_select?: { name: string }[];
  date?: { start: string; end?: string | null } | null;
  checkbox?: boolean;
  number?: number | null;
}

export interface NotionPage {
  id: string;
  created_time: string;
  last_edited_time: string;
  properties: Record<string, NotionProperty>;
  icon?: { type: string; emoji?: string } | null;
}

export interface NotionBlock {
  id: string;
  type: string;
  has_children?: boolean;
  /** Filled in by the client when it fetches nested blocks. */
  children?: NotionBlock[];
  [key: string]: unknown;
}

interface BlockBody {
  rich_text?: NotionRichText[];
  checked?: boolean;
  language?: string;
  title?: string;
  url?: string;
  caption?: NotionRichText[];
  external?: { url?: string };
  expression?: string;
  cells?: NotionRichText[][];
  icon?: { emoji?: string } | null;
}

const body = (b: NotionBlock): BlockBody => (b[b.type] as BlockBody | undefined) ?? {};

/* ── Rich text ──────────────────────────────────────────── */

const SAFE_HREF = /^(https?:|mailto:)/i;

export function plainText(rt: NotionRichText[] | undefined): string {
  return (rt ?? []).map((t) => t.plain_text).join("");
}

type Mark = { type: string; attrs?: Record<string, unknown> };
const textNode = (text: string, marks: Mark[] = []): DocNode => (marks.length ? ({ type: "text", text, marks } as DocNode) : { type: "text", text });

/** Notion rich text → editor text nodes with marks. Only http(s)/mailto links survive. */
export function inlineNodes(rt: NotionRichText[] | undefined, extra: Mark[] = []): DocNode[] {
  const out: DocNode[] = [];
  for (const t of rt ?? []) {
    if (!t.plain_text) continue;
    const marks: Mark[] = [...extra];
    const a = t.annotations ?? {};
    if (a.bold && !marks.some((m) => m.type === "bold")) marks.push({ type: "bold" });
    if (a.italic) marks.push({ type: "italic" });
    if (a.strikethrough) marks.push({ type: "strike" });
    if (a.underline) marks.push({ type: "underline" });
    if (a.code) marks.push({ type: "code" });
    if (t.href && SAFE_HREF.test(t.href)) marks.push({ type: "link", attrs: { href: t.href } });
    out.push(textNode(t.plain_text, marks));
  }
  return out;
}

function paragraph(content: DocNode[]): DocNode {
  return content.length ? { type: "paragraph", content } : { type: "paragraph" };
}

function linkParagraph(label: string, url: string | undefined): DocNode {
  if (!url || !SAFE_HREF.test(url)) return paragraph(label ? [textNode(label)] : []);
  return paragraph([textNode(label || url, [{ type: "link", attrs: { href: url } }])]);
}

/* ── Blocks → document ──────────────────────────────────── */

const LIST_WRAPPER: Record<string, string> = {
  bulleted_list_item: "bulletList",
  numbered_list_item: "orderedList",
  to_do: "taskList",
};

/** Convert one non-list block (its children are flattened in after it). */
function blockNodes(b: NotionBlock): DocNode[] {
  const d = body(b);
  const kids = b.children?.length ? blocksToNodes(b.children) : [];
  switch (b.type) {
    case "paragraph":
      return [paragraph(inlineNodes(d.rich_text)), ...kids];
    case "heading_1":
    case "heading_2":
    case "heading_3": {
      const level = Number(b.type.slice(-1));
      const content = inlineNodes(d.rich_text);
      return [{ type: "heading", attrs: { level }, ...(content.length ? { content } : {}) }, ...kids];
    }
    case "quote":
      return [{ type: "blockquote", content: [paragraph(inlineNodes(d.rich_text)), ...kids] }];
    case "callout": {
      const icon = d.icon?.emoji ? [textNode(`${d.icon.emoji} `)] : [];
      return [{ type: "blockquote", content: [paragraph([...icon, ...inlineNodes(d.rich_text)]), ...kids] }];
    }
    case "toggle":
      return [paragraph(inlineNodes(d.rich_text, [{ type: "bold" }])), ...kids];
    case "code": {
      const text = plainText(d.rich_text);
      return [{ type: "codeBlock", attrs: { language: d.language ?? null }, ...(text ? { content: [textNode(text)] } : {}) }];
    }
    case "equation":
      return d.expression ? [paragraph([textNode(d.expression, [{ type: "code" }])])] : [];
    case "divider":
      return [{ type: "horizontalRule" }];
    case "child_page":
      return [paragraph([textNode(`📄 ${d.title ?? "Untitled page"}`)])];
    case "child_database":
      return [paragraph([textNode(`🗂 ${d.title ?? "Database"} (imported into the Library)`)])];
    case "bookmark":
    case "embed":
    case "link_preview":
      return [linkParagraph(plainText(d.caption) || d.url || "", d.url)];
    case "image":
    case "video":
    case "file":
    case "pdf":
    case "audio":
      // Notion-hosted files use expiring signed URLs, so only external links are kept.
      return [linkParagraph(plainText(d.caption) || `(${b.type})`, d.external?.url)];
    case "table":
      return (b.children ?? []).map((row) => paragraph([textNode((body(row).cells ?? []).map(plainText).join("  |  ") || " ")]));
    case "column_list":
    case "column":
    case "synced_block":
      return kids;
    default:
      return d.rich_text?.length ? [paragraph(inlineNodes(d.rich_text)), ...kids] : kids;
  }
}

function listItem(b: NotionBlock): DocNode {
  const d = body(b);
  const content = [paragraph(inlineNodes(d.rich_text)), ...(b.children?.length ? blocksToNodes(b.children) : [])];
  return b.type === "to_do" ? { type: "taskItem", attrs: { checked: Boolean(d.checked) }, content } : { type: "listItem", content };
}

/** Blocks → editor nodes, grouping consecutive list items into one list. */
export function blocksToNodes(blocks: NotionBlock[]): DocNode[] {
  const out: DocNode[] = [];
  let list: DocNode | null = null;
  for (const b of blocks) {
    const wrapper = LIST_WRAPPER[b.type];
    if (wrapper) {
      if (!list || list.type !== wrapper) {
        list = { type: wrapper, content: [] };
        out.push(list);
      }
      list.content!.push(listItem(b));
      continue;
    }
    list = null;
    out.push(...blockNodes(b));
  }
  return out;
}

export function blocksToDoc(blocks: NotionBlock[]): DocNode {
  const content = blocksToNodes(blocks);
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

export interface ListEntryDraft {
  id: string;
  title: string;
  url: string | null;
  done: boolean;
}

/** One entry per top-level line of a page, for pages that are really lists ("movies to watch"). */
export function blocksToEntries(blocks: NotionBlock[]): ListEntryDraft[] {
  const out: ListEntryDraft[] = [];
  for (const b of blocks) {
    if (!["bulleted_list_item", "numbered_list_item", "to_do", "paragraph"].includes(b.type)) continue;
    const d = body(b);
    const title = plainText(d.rich_text).trim();
    if (!title) continue;
    const href = (d.rich_text ?? []).find((t) => t.href && /^https?:/i.test(t.href))?.href ?? null;
    out.push({ id: b.id, title: title.slice(0, 300), url: href ? normalizeUrl(href) : null, done: Boolean(d.checked) });
  }
  return out;
}

/* ── Properties ─────────────────────────────────────────── */

export interface RowValues {
  title: string;
  texts: Record<string, string>;
  urls: Record<string, string>;
  selects: Record<string, string[]>;
  dates: Record<string, { start: string; end: string | null }>;
  checks: Record<string, boolean>;
  numbers: Record<string, number>;
}

/** Flatten a database row's properties into plain values, keyed by lowercase property name. */
export function readRow(page: NotionPage): RowValues {
  const row: RowValues = { title: "", texts: {}, urls: {}, selects: {}, dates: {}, checks: {}, numbers: {} };
  for (const [rawName, p] of Object.entries(page.properties ?? {})) {
    const name = rawName.toLowerCase().trim();
    switch (p.type) {
      case "title":
        row.title = plainText(p.title).trim();
        break;
      case "rich_text": {
        const t = plainText(p.rich_text).trim();
        if (t) row.texts[name] = t;
        break;
      }
      case "url":
        if (p.url) row.urls[name] = p.url;
        break;
      case "email":
        if (p.email) row.urls[name] = `mailto:${p.email}`;
        break;
      case "select":
        if (p.select?.name) row.selects[name] = [p.select.name];
        break;
      case "status":
        if (p.status?.name) row.selects[name] = [p.status.name];
        break;
      case "multi_select":
        if (p.multi_select?.length) row.selects[name] = p.multi_select.map((o) => o.name);
        break;
      case "date":
        if (p.date?.start) row.dates[name] = { start: p.date.start, end: p.date.end ?? null };
        break;
      case "checkbox":
        row.checks[name] = Boolean(p.checkbox);
        break;
      case "number":
        if (typeof p.number === "number") row.numbers[name] = p.number;
        break;
    }
  }
  return row;
}

/** First value among the given property names (lowercase), in order. */
export function pick<T>(record: Record<string, T>, ...names: string[]): T | undefined {
  for (const n of names) if (n in record) return record[n];
  return undefined;
}

/** The row's first usable http(s) URL — preferring the named properties. */
export function rowUrl(row: RowValues, ...preferred: string[]): string | null {
  const candidates = [...preferred.map((n) => row.urls[n]), ...Object.values(row.urls)];
  for (const c of candidates) {
    if (!c || c.startsWith("mailto:")) continue;
    const u = normalizeUrl(c);
    if (u) return u;
  }
  return null;
}

/** "2026-09-23" or "2026-09-23T09:00:00.000+05:30" → "2026-09-23" (the date as written in Notion). */
export function dayOf(value: string | null | undefined): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value ?? "");
  return m ? m[1] : null;
}

export const isDateTime = (value: string | null | undefined) => Boolean(value && /T\d{2}:\d{2}/.test(value));

/* ── Option names → Logbook enums ───────────────────────── */

const norm = (s: string | undefined) => (s ?? "").toLowerCase().trim();

export function taskStatusOf(name: string | undefined): "not_started" | "in_progress" | "done" {
  const s = norm(name);
  if (/done|complete|finished/.test(s)) return "done";
  if (/not started|to ?do|backlog/.test(s) || !s) return "not_started";
  if (/progress|doing|started|active/.test(s)) return "in_progress";
  return "not_started";
}

export function priorityOf(name: string | undefined): "high" | "medium" | "low" | null {
  const s = norm(name);
  if (/high|urgent|\bp[01]\b/.test(s)) return "high";
  if (/med|\bp2\b/.test(s)) return "medium";
  if (/low|\bp3\b/.test(s)) return "low";
  return null;
}

export function effortOf(name: string | undefined): "small" | "medium" | "large" | null {
  const s = norm(name);
  if (/small|quick|easy|^s$/.test(s)) return "small";
  if (/med|^m$/.test(s)) return "medium";
  if (/large|big|hard|^l$/.test(s)) return "large";
  return null;
}

export function oppStatusOf(name: string | undefined): OppStatus {
  const s = norm(name);
  if (!s || s === "inbox") return "inbox";
  if (s.includes("not applied") || s.includes("interested")) return "interested";
  if (s.includes("applying") || s.includes("drafting")) return "applying";
  if (s.includes("applied") || s.includes("submitted")) return "submitted";
  if (s.includes("interview")) return "interview";
  if (/result|accept|reject|offer|won|selected/.test(s)) return "result";
  if (/closed|missed|expired|withdrawn/.test(s)) return "closed";
  return "inbox";
}

/** Match a Notion type option to the app's list (case-insensitive), else keep the original name. */
export function oppTypeOf(name: string | undefined): string | null {
  if (!name?.trim()) return null;
  return OPP_TYPES.find((t) => t.toLowerCase() === norm(name)) ?? name.trim().slice(0, 60);
}

const ITEM_TYPES: ItemType[] = ["article", "course", "video", "tool", "idea", "note", "tweet"];

export function itemTypeOf(name: string | undefined, url: string | null): ItemType {
  const s = norm(name);
  const direct = ITEM_TYPES.find((t) => s === t || s === `${t}s`);
  if (direct) return direct;
  if (/paper|blog|post|read/.test(s)) return "article";
  if (/tutorial|class|lecture/.test(s)) return "course";
  if (/youtube|talk/.test(s)) return "video";
  if (/app|library|repo|software/.test(s)) return "tool";
  return url ? detectType(url) : "note";
}

/** Tag names from a row's select / multi-select values (lowercased like the app's own tags). */
export function tagsOf(row: RowValues, exclude: string[] = []): string[] {
  const names: string[] = [];
  for (const [prop, values] of Object.entries(row.selects)) {
    if (exclude.includes(prop)) continue;
    for (const v of values) {
      const t = v.replace(/[,#]/g, " ").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 40);
      if (t) names.push(t);
    }
  }
  return [...new Set(names)].slice(0, 20);
}

/* ── What each Notion source becomes ────────────────────── */

export const SOURCE_KINDS = ["tasks_daily", "tasks_upcoming", "timetable", "opportunities", "journal", "library", "path", "note", "watchlist", "people", "skip"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const SOURCE_KIND_LABELS: Record<SourceKind, string> = {
  tasks_daily: "Tasks · Daily",
  tasks_upcoming: "Tasks · Upcoming",
  timetable: "Time Table",
  opportunities: "Opportunities",
  journal: "Journal + attendance",
  library: "Library folder",
  path: "Path",
  note: "Note",
  watchlist: "List · Watchlist",
  people: "List · People",
  skip: "Skip",
};

/** Kinds that are Notion databases (rows) rather than single pages. */
export const DATABASE_KINDS: readonly SourceKind[] = ["tasks_daily", "tasks_upcoming", "timetable", "opportunities", "journal", "library"];

export function classifyDatabase(title: string): SourceKind {
  const t = norm(title);
  if (/daily\s*log|journal|diary/.test(t)) return "journal";
  if (/daily\s*tasks?/.test(t)) return "tasks_daily";
  if (/time\s*table|timetable|schedule|time\s*blocks?/.test(t)) return "timetable";
  if (/\btasks?\b|to-?do/.test(t)) return "tasks_upcoming";
  if (/opportunit/.test(t)) return "opportunities";
  return "library";
}

export function classifyPage(title: string, heading = ""): SourceKind {
  const t = norm(title);
  if (/movie|film|series|anime|watch/.test(t)) return "watchlist";
  if (/people|follow|mentor|contacts?/.test(t)) return "people";
  if (/research|paths?/.test(norm(heading)) || /master|→|->|\bpaths?\b|mba|faang|quant|roadmap/.test(t)) return "path";
  return "note";
}

/** A Notion page/database id from a URL or a raw id (with or without dashes). */
export function notionIdFrom(input: string | undefined | null): string | null {
  const cleaned = (input ?? "").trim().split(/[?#]/)[0].replace(/-/g, "");
  const m = /([0-9a-f]{32})$/i.exec(cleaned);
  if (!m) return null;
  const h = m[1].toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Strip a leading emoji/symbol from a page title ("🧠 Notes" → "Notes"). */
export function cleanTitle(title: string): string {
  return title.replace(/^[\p{Extended_Pictographic}️‍\s]+/u, "").trim() || title.trim() || "Untitled";
}
