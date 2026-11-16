import { describe, expect, it } from "vitest";
import { buildGraph } from "./graph";
import { docLinks } from "./rich-text";

const NOTE_ID = "11111111-1111-4111-8111-111111111111";
const LINK_ID = "22222222-2222-4222-8222-222222222222";

describe("buildGraph", () => {
  const graph = buildGraph({
    folders: [
      { id: "f1", name: "ai", parentId: null },
      { id: "f2", name: "agents", parentId: "f1" },
    ],
    items: [
      { id: LINK_ID, kind: "link", title: "Attention paper", url: "https://arxiv.org/abs/1706.03762", folderId: "f2", links: [] },
      { id: NOTE_ID, kind: "note", title: "Transformers notes", url: null, folderId: null, links: ["https://arxiv.org/abs/1706.03762", `/notes/${NOTE_ID}`, "https://unknown.site"] },
      { id: "x", kind: "person", title: "ignored", url: null, folderId: null, links: [] },
    ],
    tags: [
      { itemId: LINK_ID, name: "ml" },
      { itemId: NOTE_ID, name: "ml" },
      { itemId: "x", name: "orphan" },
    ],
    paths: [{ id: "p1", name: "US Masters" }],
    tasks: [
      { id: "t1", title: "GRE", pathId: "p1" },
      { id: "t2", title: "Loose task", pathId: null },
    ],
  });
  const has = (a: string, b: string) => graph.edges.some((e) => (e.source === a && e.target === b) || (e.source === b && e.target === a));

  it("connects folders, items, tags and paths", () => {
    expect(has("folder:f2", "folder:f1")).toBe(true);
    expect(has(`item:${LINK_ID}`, "folder:f2")).toBe(true);
    expect(has(`item:${NOTE_ID}`, `item:${LINK_ID}`)).toBe(true); // note links to a saved URL
    expect(has(`item:${NOTE_ID}`, "tag:ml")).toBe(true);
    expect(has("task:t1", "path:p1")).toBe(true);
  });

  it("skips self-links, unknown URLs, orphan tags and unlinked tasks", () => {
    const ids = graph.nodes.map((n) => n.id);
    expect(ids).not.toContain("tag:orphan");
    expect(ids).not.toContain("item:x");
    expect(ids).not.toContain("task:t2");
    expect(graph.edges.every((e) => e.source !== e.target)).toBe(true);
  });

  it("counts degree", () => {
    expect(graph.nodes.find((n) => n.id === "tag:ml")?.degree).toBe(2);
  });
});

describe("docLinks", () => {
  it("collects link marks", () => {
    const doc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "see", marks: [{ type: "link", attrs: { href: "https://a.com" } }] }] }],
    };
    expect(docLinks(doc)).toEqual(["https://a.com"]);
    expect(docLinks(null)).toEqual([]);
  });
});
