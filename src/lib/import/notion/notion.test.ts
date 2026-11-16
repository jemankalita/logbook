import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import { docToText } from "@/lib/rich-text";
import type { NotionApi } from "./client";
import {
  blocksToDoc,
  blocksToEntries,
  classifyDatabase,
  classifyPage,
  cleanTitle,
  notionIdFrom,
  oppStatusOf,
  readRow,
  taskStatusOf,
  type NotionBlock,
  type NotionPage,
  type NotionProperty,
} from "./convert";
import { discoverSources, importChunk, type NotionSource } from "./importer";

/* ── Fixture builders ───────────────────────────────────── */

const rt = (text: string, extra: Record<string, unknown> = {}) => [{ plain_text: text, ...extra }];
const blk = (id: string, type: string, data: Record<string, unknown> = {}, children?: NotionBlock[]): NotionBlock => ({
  id,
  type,
  has_children: Boolean(children?.length),
  [type]: data,
  ...(children ? { children } : {}),
});
const title = (t: string): NotionProperty => ({ type: "title", title: rt(t) });
const text = (t: string): NotionProperty => ({ type: "rich_text", rich_text: rt(t) });
const select = (name: string): NotionProperty => ({ type: "select", select: { name } });
const status = (name: string): NotionProperty => ({ type: "status", status: { name } });
const date = (start: string, end: string | null = null): NotionProperty => ({ type: "date", date: { start, end } });
const url = (u: string): NotionProperty => ({ type: "url", url: u });
const page = (id: string, properties: Record<string, NotionProperty>, edited = "2026-09-20T10:00:00.000Z"): NotionPage => ({
  id,
  created_time: "2026-09-01T04:00:00.000Z",
  last_edited_time: edited,
  properties,
});

/* ── Pure conversion ────────────────────────────────────── */

describe("Notion block conversion", () => {
  it("groups list items, keeps marks and drops unsafe links", () => {
    const doc = blocksToDoc([
      blk("1", "heading_2", { rich_text: rt("Plan") }),
      blk("2", "bulleted_list_item", { rich_text: rt("one", { annotations: { bold: true } }) }),
      blk("3", "bulleted_list_item", { rich_text: rt("two") }, [blk("3a", "bulleted_list_item", { rich_text: rt("nested") })]),
      blk("4", "to_do", { rich_text: rt("ship"), checked: true }),
      blk("5", "paragraph", { rich_text: [{ plain_text: "evil", href: "javascript:alert(1)" }, { plain_text: " good", href: "https://ok.dev" }] }),
      blk("6", "divider"),
      blk("7", "image", { type: "file", file: { url: "https://s3.signed/x" }, caption: [] }),
    ]);
    const types = doc.content!.map((n) => n.type);
    expect(types).toEqual(["heading", "bulletList", "taskList", "paragraph", "horizontalRule", "paragraph"]);
    expect(doc.content![1].content).toHaveLength(2);
    expect(doc.content![2].content![0].attrs).toEqual({ checked: true });
    const json = JSON.stringify(doc);
    expect(json).not.toContain("javascript:");
    expect(json).toContain("https://ok.dev");
    expect(json).not.toContain("s3.signed"); // expiring Notion-hosted file URLs are not kept
    expect(docToText(doc)).toContain("nested");
  });

  it("turns a page of lines into list entries", () => {
    const entries = blocksToEntries([
      blk("a", "numbered_list_item", { rich_text: rt("Interstellar") }),
      blk("b", "to_do", { rich_text: [{ plain_text: "Dune", href: "https://imdb.com/title/tt1160419" }], checked: true }),
      blk("c", "paragraph", { rich_text: [] }),
    ]);
    expect(entries).toEqual([
      { id: "a", title: "Interstellar", url: null, done: false },
      { id: "b", title: "Dune", url: "https://imdb.com/title/tt1160419", done: true },
    ]);
  });

  it("reads properties by lowercase name and maps option names", () => {
    const row = readRow(page("p", { "Task name": title("Revise DP"), Status: status("In progress"), "Due date": date("2026-11-20") }));
    expect(row.title).toBe("Revise DP");
    expect(row.selects.status).toEqual(["In progress"]);
    expect(row.dates["due date"].start).toBe("2026-11-20");
    expect(taskStatusOf("Not started")).toBe("not_started");
    expect(taskStatusOf("Done")).toBe("done");
    expect(taskStatusOf("In progress")).toBe("in_progress");
    expect(oppStatusOf("Not Applied")).toBe("interested");
    expect(oppStatusOf("Applied")).toBe("submitted");
    expect(oppStatusOf("Result")).toBe("result");
  });

  it("classifies sources and parses ids", () => {
    expect(classifyDatabase("Daily Tasks ")).toBe("tasks_daily");
    expect(classifyDatabase("Overall Tasks TODO")).toBe("tasks_upcoming");
    expect(classifyDatabase("Daily Time Table")).toBe("timetable");
    expect(classifyDatabase("Daily Log")).toBe("journal");
    expect(classifyDatabase("Opportunities")).toBe("opportunities");
    expect(classifyDatabase("AI Tools")).toBe("library");
    expect(classifyPage("Masters Abroad", "RESEARCH")).toBe("path");
    expect(classifyPage("movies to watch : ")).toBe("watchlist");
    expect(classifyPage("PEOPLE TO STUDY ( FOLLOW ) ")).toBe("people");
    expect(classifyPage("good paying companies ", "Vaults")).toBe("note");
    expect(notionIdFrom("https://app.notion.com/p/3d63cfe2d25c813e8451e7c2b8a8c6ee?pvs=204")).toBe("3d63cfe2-d25c-813e-8451-e7c2b8a8c6ee");
    expect(notionIdFrom("https://www.notion.so/My-Page-3d63cfe2d25c813e8451e7c2b8a8c6ee")).toBe("3d63cfe2-d25c-813e-8451-e7c2b8a8c6ee");
    expect(notionIdFrom("not an id")).toBeNull();
    expect(cleanTitle("🧠 My Second Brain")).toBe("My Second Brain");
  });
});

/* ── End-to-end import into a real (in-memory) Postgres ── */

let client: PGlite;
let db: Db;

beforeAll(async () => {
  client = new PGlite();
  const pg = drizzle(client, { schema });
  await migrate(pg, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  db = pg as unknown as Db;
}, 60_000);

afterAll(async () => {
  await client.close();
});

const ROOT: NotionBlock[] = [
  blk("h1", "heading_1", { rich_text: rt("Today") }),
  blk("db-tasks", "child_database", { title: "Daily Tasks" }),
  blk("db-tt", "child_database", { title: "Daily Time Table" }),
  blk("h2", "heading_1", { rich_text: rt("RESEARCH") }),
  blk("pg-us", "child_page", { title: "Masters Abroad" }),
  blk("h3", "heading_1", { rich_text: rt("Vaults") }),
  blk("db-opps", "child_database", { title: "Opportunities" }),
  blk("db-tools", "child_database", { title: "AI Tools" }),
  blk("pg-movies", "child_page", { title: "movies to watch : " }),
];

const DB_ROWS: Record<string, NotionPage[]> = {
  "db-tasks": [
    page("t1", { "Task name": title("Solve 3 DP problems"), Status: status("Done"), Priority: select("High"), "Effort level": select("Small") }),
    page("t2", { "Task name": title("Email professor"), Status: status("Not started"), "Due date": date("2026-11-20") }),
    page("t3", { "Task name": title("") }),
  ],
  "db-tt": [
    page("b1", { Block: title("DSA sprint"), When: date("2026-09-23T09:00:00.000+05:30", "2026-09-23T11:00:00.000+05:30"), Area: select("DSA"), Done: { type: "checkbox", checkbox: true } }),
    page("b2", { Block: title("All-day thing"), When: date("2026-09-24") }),
  ],
  "db-opps": [page("o1", { Opportunity: title("GSoC 2027"), Status: select("Not Applied"), Type: select("Open source"), Deadline: date("2027-03-01"), Link: url("https://summerofcode.withgoogle.com"), "Next action": text("Pick an org") })],
  "db-tools": [
    page("l1", { Name: title("Cursor"), URL: url("https://cursor.com"), Category: select("Coding"), Notes: text("AI editor") }),
    page("l2", { Name: title("Idea without link"), Category: select("Other") }),
  ],
  "db-unis": [page("u1", { Name: title("CMU MSCS"), Link: url("https://www.cs.cmu.edu/") })],
};

const PAGE_BLOCKS: Record<string, NotionBlock[]> = {
  root: ROOT,
  "pg-us": [blk("p1", "paragraph", { rich_text: rt("Collect programs and insights.") }), blk("db-unis", "child_database", { title: "Universities" })],
  "pg-movies": [blk("m1", "bulleted_list_item", { rich_text: rt("Interstellar") }), blk("m2", "bulleted_list_item", { rich_text: rt("Arrival") })],
  o1: [blk("ob", "paragraph", { rich_text: rt("Mentor: Dr. X") })],
};

const fakeApi: NotionApi = {
  databaseTitle: async (id) => id,
  queryDatabase: async (id, cursor, pageSize) => {
    const rows = DB_ROWS[id] ?? [];
    const start = cursor ? Number(cursor) : 0;
    const end = start + pageSize;
    return { results: rows.slice(start, end), nextCursor: end < rows.length ? String(end) : null };
  },
  page: async (id) => ({ ...page(id, {}), icon: { type: "emoji", emoji: "🎓" } }),
  blocks: async (id) => structuredClone(PAGE_BLOCKS[id] ?? []),
};

async function runAll(sources: NotionSource[]) {
  let added = 0;
  for (const s of sources) {
    let cursor: string | null = null;
    do {
      const res = await importChunk(db, fakeApi, s, cursor, "Asia/Kolkata");
      added += res.added;
      cursor = res.nextCursor;
    } while (cursor);
  }
  return added;
}

describe("Notion import (integration)", () => {
  it("discovers databases and pages, including databases nested in a sub-page", async () => {
    const { sources } = await discoverSources(fakeApi, "root");
    const byId = Object.fromEntries(sources.map((s) => [s.id, s]));
    expect(byId["db-tasks"].kind).toBe("tasks_daily");
    expect(byId["db-tt"].kind).toBe("timetable");
    expect(byId["pg-us"].kind).toBe("path");
    expect(byId["db-opps"].kind).toBe("opportunities");
    expect(byId["db-tools"].kind).toBe("library");
    expect(byId["pg-movies"].kind).toBe("watchlist");
    expect(byId["db-unis"]).toMatchObject({ kind: "library", isDatabase: true, parent: "Masters Abroad" });
  });

  it("imports everything into the right places, and a second run adds nothing", async () => {
    const { sources } = await discoverSources(fakeApi, "root");
    const first = await runAll(sources);
    expect(first).toBeGreaterThan(0);

    const allTasks = await db.select().from(schema.tasks);
    expect(allTasks.map((t) => t.title).sort()).toEqual(["Email professor", "Solve 3 DP problems"]); // untitled row skipped
    const solved = allTasks.find((t) => t.title === "Solve 3 DP problems")!;
    expect(solved).toMatchObject({ status: "done", priority: "high", effort: "small", horizon: "daily" });
    expect(await db.select().from(schema.taskCompletions).where(eq(schema.taskCompletions.taskId, solved.id))).toHaveLength(1);

    const blocks = await db.select().from(schema.timeBlocks);
    expect(blocks).toHaveLength(1); // the all-day entry has no slot
    expect(blocks[0]).toMatchObject({ title: "DSA sprint", area: "DSA", done: true });
    expect(blocks[0].startsAt.toISOString()).toBe("2026-09-23T03:30:00.000Z");

    const [opp] = await db.select().from(schema.opportunities);
    expect(opp).toMatchObject({ name: "GSoC 2027", status: "interested", type: "Open source", deadline: "2027-03-01", nextAction: "Pick an org" });
    expect(opp.notes).toContain("Mentor: Dr. X");

    const links = await db.select().from(schema.items);
    const cursor = links.find((i) => i.title === "Cursor")!;
    expect(cursor).toMatchObject({ kind: "link", summary: "AI editor", source: "notion" });
    expect(cursor.url).toMatch(/^https:\/\/cursor\.com\/?$/);
    expect(links.find((i) => i.title === "Idea without link")!.kind).toBe("note");

    const folderRows = await db.select().from(schema.folders);
    const parent = folderRows.find((f) => f.name === "Masters Abroad")!;
    expect(folderRows.find((f) => f.name === "Universities")!.parentId).toBe(parent.id);

    const [path_] = await db.select().from(schema.paths);
    expect(path_).toMatchObject({ name: "Masters Abroad", emoji: "🎓" });
    expect(path_.bodyText).toContain("Collect programs");

    const [list] = await db.select().from(schema.lists);
    expect(list.kind).toBe("watchlist");
    expect((await db.select().from(schema.listEntries)).map((e) => e.title)).toEqual(["Interstellar", "Arrival"]);

    const tagNames = (await db.select().from(schema.tags)).map((t) => t.name);
    expect(tagNames).toContain("coding");

    // Re-running is a no-op.
    const second = await runAll(sources);
    expect(second).toBe(0);
    expect(await db.select().from(schema.tasks)).toHaveLength(2);
    expect(await db.select().from(schema.paths)).toHaveLength(1);
  });

  it("merges two Daily Log rows for the same day instead of dropping one", async () => {
    DB_ROWS["db-log"] = [
      page("j1", { Name: title("Morning"), Date: date("2026-10-05"), Wins: text("Shipped the heatmap") }),
      page("j2", { Name: title("Evening"), Date: date("2026-10-05"), Wins: text("Read two papers") }),
    ];
    const res = await importChunk(db, fakeApi, { id: "db-log", title: "Daily Log", kind: "journal", isDatabase: true, parent: null }, null, "Asia/Kolkata");
    expect(res.added).toBe(2);
    const [entry] = await db.select().from(schema.journal).where(eq(schema.journal.day, "2026-10-05"));
    expect(entry.bodyText).toContain("Shipped the heatmap");
    expect(entry.bodyText).toContain("Read two papers");
    expect(await db.select().from(schema.attendance).where(eq(schema.attendance.day, "2026-10-05"))).toHaveLength(1);
  });

  it("keeps importing the rest of a chunk when one row fails, and doesn't mark the bad row as done", async () => {
    DB_ROWS["db-tt2"] = [
      page("bad", { Block: title("Broken"), When: date("2026-13-45T09:00:00.000+05:30") }),
      page("good", { Block: title("Floating time"), When: { type: "date", date: { start: "2026-10-06T09:00:00.000", end: null, time_zone: "Asia/Kolkata" } } as NotionProperty }),
    ];
    const res = await importChunk(db, fakeApi, { id: "db-tt2", title: "Time Table 2", kind: "timetable", isDatabase: true, parent: null }, null, "UTC");
    expect(res).toMatchObject({ added: 1, failed: 1, nextCursor: null });
    const [block] = await db.select().from(schema.timeBlocks).where(eq(schema.timeBlocks.title, "Floating time"));
    // 09:00 in Asia/Kolkata, not 09:00 server time.
    expect(block.startsAt.toISOString()).toBe("2026-10-06T03:30:00.000Z");
    const mapped = await db.select().from(schema.importMap).where(eq(schema.importMap.externalId, "bad"));
    expect(mapped).toHaveLength(0);
  });

  it("reports when the scan ran out of request budget", async () => {
    const truncatingApi: NotionApi = { ...fakeApi, blocks: async (id, opts) => (opts?.onTruncated?.(), structuredClone(PAGE_BLOCKS[id] ?? [])) };
    const { truncated } = await discoverSources(truncatingApi, "root");
    expect(truncated).toBe(true);
    expect((await discoverSources(fakeApi, "root")).truncated).toBe(false);
  });

  it("refuses a page/database type mismatch", async () => {
    await expect(importChunk(db, fakeApi, { id: "pg-us", title: "x", kind: "library", isDatabase: false, parent: null }, null, "UTC")).rejects.toThrow(/page/);
  });
});
