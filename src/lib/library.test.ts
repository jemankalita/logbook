import { describe, expect, it } from "vitest";
import { likePattern, parseTags, safeReturnPath } from "./actions";
import { countBookmarks, isBookmarkExport, parseChromeBookmarks, topLevelNodes, type BookmarkFolder } from "./import/chrome-bookmarks";
import { isPrivateAddress } from "./net/safe-fetch";
import { decodeEntities, parseMeta } from "./preview/parse-meta";
import { buildFolderTree, descendantIds, folderBreadcrumbs, type Folder } from "./queries/library";
import { docToText, parseDocJson, textToDoc } from "./rich-text";
import { detectType, normalizeUrl, tweetIdFromUrl, youtubeIdFromUrl } from "./url";

describe("normalizeUrl", () => {
  it("adds https and keeps valid links", () => {
    expect(normalizeUrl("example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(normalizeUrl("  http://x.org  ")).toBe("http://x.org/");
  });

  it("rejects non-web schemes and junk", () => {
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("chrome://settings")).toBeNull();
    expect(normalizeUrl("hello world")).toBeNull();
    expect(normalizeUrl("notadomain")).toBeNull();
    expect(normalizeUrl("")).toBeNull();
  });
});

describe("link type detection", () => {
  it("recognises X posts, YouTube, courses and tools", () => {
    expect(tweetIdFromUrl("https://x.com/karpathy/status/1234567890123")).toBe("1234567890123");
    expect(tweetIdFromUrl("https://twitter.com/a/status/99999/photo/1")).toBe("99999");
    expect(tweetIdFromUrl("https://x.com/karpathy")).toBeNull();
    expect(tweetIdFromUrl("https://evil.com/a/status/123456")).toBeNull();
    expect(detectType("https://x.com/a/status/123456")).toBe("tweet");
    expect(detectType("https://www.youtube.com/watch?v=abc")).toBe("video");
    expect(detectType("https://www.coursera.org/learn/ml")).toBe("course");
    expect(detectType("https://github.com/vercel/next.js")).toBe("tool");
    expect(detectType("https://random.site/page")).toBe("other");
  });

  it("extracts YouTube ids from every URL shape", () => {
    expect(youtubeIdFromUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdFromUrl("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdFromUrl("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdFromUrl("https://vimeo.com/123")).toBeNull();
  });
});

describe("parseMeta", () => {
  const html = `<html><head>
    <title>Fallback &amp; title</title>
    <meta property="og:title" content="OG &quot;Title&quot;">
    <meta name="description" content="Plain description">
    <meta property='og:image' content='/img/cover.png'>
    <link rel="shortcut icon" href="/fav.ico">
  </head></html>`;

  it("prefers Open Graph tags and resolves relative URLs", () => {
    const meta = parseMeta(html, "https://site.dev/post/1");
    expect(meta.title).toBe('OG "Title"');
    expect(meta.description).toBe("Plain description");
    expect(meta.image).toBe("https://site.dev/img/cover.png");
    expect(meta.favicon).toBe("https://site.dev/fav.ico");
  });

  it("falls back to <title> and /favicon.ico", () => {
    const meta = parseMeta("<title> Just a   title </title>", "https://a.com/x");
    expect(meta.title).toBe("Just a title");
    expect(meta.favicon).toBe("https://a.com/favicon.ico");
    expect(meta.image).toBeNull();
  });

  it("ignores javascript: image URLs", () => {
    expect(parseMeta('<meta property="og:image" content="javascript:alert(1)">', "https://a.com").image).toBeNull();
  });

  it("decodes numeric entities safely", () => {
    expect(decodeEntities("&#8217; &#x2014; &#99999999;")).toBe("’ — &#99999999;");
  });
});

describe("isPrivateAddress (SSRF guard)", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])(
    "blocks %s",
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );
  it.each(["8.8.8.8", "1.1.1.1", "172.32.0.1", "142.250.183.14", "2606:4700:4700::1111"])("allows %s", (ip) => expect(isPrivateAddress(ip)).toBe(false));
  it("treats non-IPs as unsafe", () => expect(isPrivateAddress("localhost")).toBe(true));
});

const EXPORT = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1700000000" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>
    <DL><p>
        <DT><H3 ADD_DATE="1700000001">ai</H3>
        <DL><p>
            <DT><A HREF="https://arxiv.org/abs/1706.03762" ADD_DATE="1700000100" ICON="data:image/png;base64,AAAA">Attention Is All You Need</A>
            <DT><H3>agents</H3>
            <DL><p>
                <DT><A HREF="https://x.com/someone/status/1234567890">A thread &amp; notes</A>
            </DL><p>
        </DL><p>
        <DT><H3>hackathons</H3>
        <DL><p>
            <DT><A HREF="https://devpost.com/">Devpost</A>
            <DT><A HREF="javascript:void(0)">A bookmarklet</A>
        </DL><p>
        <DT><A HREF="https://news.ycombinator.com/">Hacker News</A>
    </DL><p>
    <DT><H3>Other bookmarks</H3>
    <DL><p>
        <DT><H3>cf resources</H3>
        <DL><p>
            <DT><A HREF="https://codeforces.com/blog/entry/1">CF blog</A>
        </DL><p>
    </DL><p>
</DL><p>`;

describe("Chrome bookmarks parser", () => {
  const root = parseChromeBookmarks(EXPORT);
  const top = topLevelNodes(root);

  it("detects the export format", () => {
    expect(isBookmarkExport(EXPORT)).toBe(true);
    expect(isBookmarkExport("<html><body>hi</body></html>")).toBe(false);
  });

  it("unwraps Chrome's built-in roots and keeps your folders nested", () => {
    expect(top.map((n) => (n.type === "folder" ? `📁${n.name}` : n.title))).toEqual(["📁ai", "📁hackathons", "Hacker News", "📁cf resources"]);
    const ai = top[0] as BookmarkFolder;
    expect(ai.children.map((n) => n.type)).toEqual(["link", "folder"]);
    const agents = ai.children[1] as BookmarkFolder;
    expect(agents.children[0]).toMatchObject({ type: "link", url: "https://x.com/someone/status/1234567890", title: "A thread & notes" });
  });

  it("keeps add dates and small icons, drops javascript: bookmarklets", () => {
    const paper = (top[0] as BookmarkFolder).children[0];
    expect(paper).toMatchObject({ type: "link", icon: "data:image/png;base64,AAAA" });
    expect(paper.type === "link" && paper.addedAt?.toISOString()).toBe("2023-11-14T22:15:00.000Z");
    expect(countBookmarks(top)).toEqual({ folders: 4, links: 5 });
  });
});

describe("folder tree", () => {
  const f = (id: string, name: string, parentId: string | null): Folder => ({ id, name, parentId, emoji: null, color: null, position: 0, createdAt: new Date(0) });
  const tree = buildFolderTree([f("a", "ai", null), f("b", "agents", "a"), f("c", "rag", "b"), f("d", "misc", null)], new Map([["a", 2], ["b", 1], ["c", 4]]));

  it("nests children and sums totals", () => {
    expect(tree.map((n) => [n.name, n.total])).toEqual([["ai", 7], ["misc", 0]]);
    expect(tree[0].children[0].children[0].depth).toBe(2);
  });

  it("finds descendants and breadcrumbs", () => {
    expect(descendantIds(tree, "a").sort()).toEqual(["a", "b", "c"]);
    expect(folderBreadcrumbs(tree, "c").map((n) => n.name)).toEqual(["ai", "agents", "rag"]);
  });
});

describe("form helpers", () => {
  it("parses tags", () => expect(parseTags("ML, #ai,ml , ,interview prep")).toEqual(["ml", "ai", "interview prep"]));
  it("escapes LIKE wildcards", () => expect(likePattern("100%_x")).toBe("%100\\%\\_x%"));
  it("only allows relative return paths", () => {
    expect(safeReturnPath("/library?folder=1", "/")).toBe("/library?folder=1");
    expect(safeReturnPath("//evil.com", "/")).toBe("/");
    expect(safeReturnPath("https://evil.com", "/")).toBe("/");
  });
});

describe("rich text", () => {
  it("round-trips plain text", () => {
    const doc = textToDoc("line one\n\nline three");
    expect(docToText(doc)).toBe("line one\nline three");
  });

  it("extracts text from nested blocks", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", content: [{ type: "text", text: "Plan" }] },
        { type: "taskList", content: [{ type: "taskItem", content: [{ type: "paragraph", content: [{ type: "text", text: "GRE" }] }] }] },
      ],
    };
    expect(docToText(doc)).toBe("Plan\nGRE");
  });

  it("rejects non-documents", () => {
    expect(parseDocJson('{"type":"doc","content":[]}')).toEqual({ type: "doc", content: [] });
    expect(parseDocJson('{"type":"script"}')).toBeNull();
    expect(parseDocJson("not json")).toBeNull();
  });
});
