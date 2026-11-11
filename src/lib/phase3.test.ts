import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import { addDays, today } from "./dates";
import { parseChromeBookmarks, topLevelNodes } from "./import/chrome-bookmarks";
import { importBookmarkTree } from "./import/import-bookmarks";
import { getActivity } from "./queries/activity";
import { getFolderTree } from "./queries/library";
import { countdownLabel, upcomingDeadlines } from "./queries/opportunities";
import { searchEverything } from "./queries/search";
import { getHabits, getTodayTasks, getUpcomingTasks } from "./queries/tasks";

/**
 * Integration tests against a real (in-memory) Postgres with the real migrations,
 * injected where getDb() looks for its cached connection.
 */
let client: PGlite;
let db: Db;

beforeAll(async () => {
  client = new PGlite();
  const pg = drizzle(client, { schema });
  await migrate(pg, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  db = pg as unknown as Db;
  (globalThis as unknown as { __logbookDb?: Promise<Db> }).__logbookDb = Promise.resolve(db);
}, 60_000);

afterAll(async () => {
  (globalThis as unknown as { __logbookDb?: Promise<Db> }).__logbookDb = undefined;
  await client.close();
});

const EXPORT = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>Bookmarks bar</H3>
  <DL><p>
    <DT><H3>ai</H3>
    <DL><p>
      <DT><A HREF="https://arxiv.org/abs/1706.03762" ADD_DATE="1700000100">Attention</A>
      <DT><H3>agents</H3>
      <DL><p><DT><A HREF="https://example.com/agents">Agents</A></DL><p>
    </DL><p>
    <DT><A HREF="https://news.ycombinator.com/">HN</A>
  </DL><p>
</DL><p>`;

describe("Chrome import into the database", () => {
  it("creates folders and links, and is safe to run twice", async () => {
    const nodes = topLevelNodes(parseChromeBookmarks(EXPORT));
    const first = await importBookmarkTree(db, nodes);
    expect(first).toEqual({ foldersCreated: 2, linksAdded: 3, duplicates: 0 });

    const second = await importBookmarkTree(db, nodes);
    expect(second).toEqual({ foldersCreated: 0, linksAdded: 0, duplicates: 3 });

    const tree = await getFolderTree();
    expect(tree.map((f) => [f.name, f.count, f.total])).toEqual([["ai", 1, 2]]);
    expect(tree[0].children.map((f) => f.name)).toEqual(["agents"]);
  });

  it("keeps the original bookmark date", async () => {
    const [row] = await db.select().from(schema.items).where(eq(schema.items.url, "https://arxiv.org/abs/1706.03762"));
    expect(row?.createdAt.toISOString()).toBe("2023-11-14T22:15:00.000Z");
  });
});

describe("tasks, habits and the heatmap", () => {
  it("shows today's and upcoming tasks in the right views", async () => {
    const t = today();
    await db.insert(schema.tasks).values([
      { title: "Overdue essay", horizon: "daily", dueDate: addDays(t, -2) },
      { title: "Today thing", horizon: "daily", dueDate: t },
      { title: "Tomorrow thing", horizon: "upcoming", dueDate: addDays(t, 1) },
      { title: "Someday", horizon: "upcoming" },
      { title: "Big goal", horizon: "roadmap" },
    ]);
    expect((await getTodayTasks(t)).map((x) => x.title).sort()).toEqual(["Overdue essay", "Today thing"]);
    expect((await getUpcomingTasks(t)).map((x) => x.title)).toEqual(["Tomorrow thing", "Someday"]);
  });

  it("tracks habit completions, streaks and the tasks heatmap", async () => {
    const t = today();
    const [habit] = await db
      .insert(schema.tasks)
      .values({ title: "Solve 2 CF problems", recurrence: "daily", dueDate: addDays(t, -5) })
      .returning();
    await db.insert(schema.taskCompletions).values([addDays(t, -2), addDays(t, -1), t].map((day) => ({ taskId: habit.id, day })));

    const { scheduled } = await getHabits(t);
    const h = scheduled.find((x) => x.id === habit.id);
    expect(h?.doneToday).toBe(true);
    expect(h?.streak).toBe(3);
    expect(h?.week.slice(-3)).toEqual([true, true, true]);

    const activity = await getActivity();
    expect(activity.tasksByDay.get(t)).toBe(1);
  });
});

describe("deadlines and search", () => {
  it("merges opportunity, task and link deadlines, skipping finished ones", async () => {
    const t = today();
    await db.insert(schema.opportunities).values([
      { name: "Google STEP", deadline: addDays(t, 3), status: "applying" },
      { name: "Old hackathon", deadline: addDays(t, 2), status: "closed" },
    ]);
    const list = await upcomingDeadlines(t, 30);
    const titles = list.map((d) => d.title);
    expect(titles).toContain("Google STEP");
    expect(titles).toContain("Tomorrow thing");
    expect(titles).not.toContain("Old hackathon");
    expect(countdownLabel(3)).toBe("in 3d");
    expect(countdownLabel(-2)).toBe("2d overdue");
  });

  it("finds links, tasks and opportunities from one query", async () => {
    const kinds = new Set((await searchEverything("google")).map((h) => h.kind));
    expect(kinds.has("opportunity")).toBe(true);
    const hits = await searchEverything("attention");
    expect(hits[0]).toMatchObject({ kind: "link", title: "Attention" });
    expect(await searchEverything("x")).toEqual([]);
  });

  it("treats LIKE wildcards literally", async () => {
    expect(await searchEverything("%%")).toEqual([]);
  });
});
