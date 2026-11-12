import { decodeEntities } from "@/lib/preview/parse-meta";
import { normalizeUrl } from "@/lib/url";

/**
 * Parser for Chrome's "Export bookmarks" file (the Netscape bookmark format):
 *
 *   <DL><p>
 *     <DT><H3 ADD_DATE="1700000000">ai</H3>
 *     <DL><p>
 *       <DT><A HREF="https://…" ADD_DATE="1700000000" ICON="data:image/png;base64,…">Title</A>
 *     </DL><p>
 *   </DL><p>
 *
 * Pure string parsing, so it runs on the server and in tests.
 */

export interface BookmarkLink {
  type: "link";
  url: string;
  title: string;
  addedAt: Date | null;
  icon: string | null;
}

export interface BookmarkFolder {
  type: "folder";
  name: string;
  children: BookmarkNode[];
}

export type BookmarkNode = BookmarkLink | BookmarkFolder;

/** Chrome's built-in roots; their contents are imported, the roots themselves are not. */
export const CHROME_ROOT_FOLDERS = new Set(["bookmarks bar", "bookmarks", "other bookmarks", "mobile bookmarks", "favorites bar", "favourites bar"]);

const MAX_ICON_CHARS = 6_000;
// Titles are bounded so a malformed file (an unclosed <A> repeated many times) can't make
// each match scan to the end of a 20 MB input — that would be quadratic.
const TOKEN_RE = /<DT>\s*<H3\b([^>]*)>([\s\S]{0,2000}?)<\/H3>|<DT>\s*<A\b([^>]*)>([\s\S]{0,2000}?)<\/A>|<DL\b[^>]*>|<\/DL>/gi;

function attr(attrs: string, name: string): string | undefined {
  const m = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i").exec(attrs);
  return m ? m[1] : undefined;
}

function text(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}

export function isBookmarkExport(html: string): boolean {
  return /<!DOCTYPE NETSCAPE-Bookmark-file-1>/i.test(html) || (/<DL\b/i.test(html) && /<DT>\s*<(A|H3)\b/i.test(html));
}

export function parseChromeBookmarks(html: string): BookmarkFolder {
  const root: BookmarkFolder = { type: "folder", name: "", children: [] };
  const stack: BookmarkFolder[] = [];
  let pending: BookmarkFolder | null = null;

  for (const m of html.matchAll(TOKEN_RE)) {
    const token = m[0];
    const current = stack[stack.length - 1] ?? root;

    if (m[2] !== undefined) {
      const folder: BookmarkFolder = { type: "folder", name: text(m[2]) || "Untitled folder", children: [] };
      current.children.push(folder);
      pending = folder;
    } else if (m[4] !== undefined) {
      const url = normalizeUrl(decodeEntities(attr(m[3] ?? "", "HREF") ?? ""));
      if (!url) continue; // javascript: bookmarklets, chrome:// pages, etc.
      const added = Number(attr(m[3] ?? "", "ADD_DATE"));
      const icon = attr(m[3] ?? "", "ICON");
      current.children.push({
        type: "link",
        url,
        title: text(m[4]) || url,
        addedAt: Number.isFinite(added) && added > 0 ? new Date(added * 1000) : null,
        icon: icon && icon.startsWith("data:image/") && icon.length <= MAX_ICON_CHARS ? icon : null,
      });
    } else if (/^<DL/i.test(token)) {
      // A list right after a folder heading holds that folder's contents;
      // the outermost list is the root itself.
      if (pending) {
        stack.push(pending);
        pending = null;
      }
    } else if (stack.length > 0) {
      stack.pop();
    }
  }
  return root;
}

/** Root's children, with Chrome's built-in containers ("Bookmarks bar", …) unwrapped. */
export function topLevelNodes(root: BookmarkFolder): BookmarkNode[] {
  return root.children.flatMap((n) => (n.type === "folder" && CHROME_ROOT_FOLDERS.has(n.name.toLowerCase()) ? n.children : [n]));
}

export interface BookmarkStats {
  folders: number;
  links: number;
}

export function countBookmarks(nodes: BookmarkNode[]): BookmarkStats {
  let folders = 0;
  let links = 0;
  const walk = (list: BookmarkNode[]) => {
    for (const n of list) {
      if (n.type === "link") links++;
      else {
        folders++;
        walk(n.children);
      }
    }
  };
  walk(nodes);
  return { folders, links };
}
