import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import { BACKUP_TABLES, buildBackup, isBackupTokenValid, MIN_BACKUP_TOKEN_LENGTH } from "./backup";
import { getFolderTree } from "./queries/library";
import { getWeekReview, moveTasksToNextWeek } from "./queries/review";
import { rescheduleOverdueTasks } from "./queries/tasks";
import { reviewKey } from "./review";

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

describe("isBackupTokenValid", () => {
  const token = "x".repeat(MIN_BACKUP_TOKEN_LENGTH);

  it("accepts the exact bearer token", () => {
    expect(isBackupTokenValid(`Bearer ${token}`, token)).toBe(true);
  });

  it("rejects a wrong, missing or malformed header", () => {
    expect(isBackupTokenValid(`Bearer ${"y".repeat(MIN_BACKUP_TOKEN_LENGTH)}`, token)).toBe(false);
    expect(isBackupTokenValid(null, token)).toBe(false);
    expect(isBackupTokenValid(token, token)).toBe(false);
    expect(isBackupTokenValid(`Bearer ${token}x`, token)).toBe(false);
  });

  it("is disabled when the configured token is missing or too short", () => {
    expect(isBackupTokenValid("Bearer ", "")).toBe(false);
    expect(isBackupTokenValid("Bearer short", "short")).toBe(false);
    expect(isBackupTokenValid(`Bearer ${token}`, undefined)).toBe(false);
  });
});

describe("buildBackup", () => {
  it("exports every table except login throttling, with its rows", async () => {
    await db.insert(schema.tasks).values({ title: "Backup me", horizon: "upcoming" });
    const backup = await buildBackup(db);
    expect(backup.app).toBe("logbook");
    expect(Object.keys(backup.tables).sort()).toEqual([...BACKUP_TABLES].sort());
    expect(backup.tables).not.toHaveProperty("login_attempts");
    expect(backup.tables.tasks.some((t) => (t as { title: string }).title === "Backup me")).toBe(true);
    expect(() => JSON.parse(JSON.stringify(backup))).not.toThrow();
  });
});

describe("folder counts include pages", () => {
  it("counts notes filed in a folder alongside links", async () => {
    const [folder] = await db.insert(schema.folders).values({ name: "Academic" }).returning();
    await db.insert(schema.items).values([
      { kind: "note", type: "note", title: "Title-only row", folderId: folder.id },
      { kind: "link", title: "A link", url: "https://example.com/a", folderId: folder.id },
    ]);
    const node = (await getFolderTree()).find((f) => f.id === folder.id);
    expect(node?.count).toBe(2);
  });
});

describe("rescheduleOverdueTasks", () => {
  it("moves only open, one-off, past-due tasks of that list", async () => {
    const rows = await db
      .insert(schema.tasks)
      .values([
        { title: "late daily", horizon: "daily", dueDate: "2025-02-03" },
        { title: "late done", horizon: "daily", dueDate: "2025-02-03", status: "done" },
        { title: "late habit", horizon: "daily", dueDate: "2025-02-03", recurrence: "daily" },
        { title: "late upcoming", horizon: "upcoming", dueDate: "2025-02-03" },
        { title: "future daily", horizon: "daily", dueDate: "2026-12-30" },
      ])
      .returning();
    const byTitle = async (title: string) => (await db.select().from(schema.tasks)).find((t) => t.title === title);

    expect(await rescheduleOverdueTasks("daily", "2026-11-24", "today")).toBe(1);
    expect((await byTitle("late daily"))?.dueDate).toBe("2026-11-24");
    expect((await byTitle("late done"))?.dueDate).toBe("2025-02-03");
    expect((await byTitle("late habit"))?.dueDate).toBe("2025-02-03");
    expect((await byTitle("late upcoming"))?.dueDate).toBe("2025-02-03");
    expect((await byTitle("future daily"))?.dueDate).toBe("2026-12-30");

    expect(await rescheduleOverdueTasks("upcoming", "2026-11-24", "clear")).toBe(1);
    expect((await byTitle("late upcoming"))?.dueDate).toBeNull();
    expect(rows).toHaveLength(5);
  });
});

describe("weekly review", () => {
  const week = "2026-11-09"; // Mon 9 – Sun 15 Nov 2026

  it("collects what got done, what carries over, and next week's plan", async () => {
    const [doneTask, openLate, openThisWeek, nextWeek, habit] = await db
      .insert(schema.tasks)
      .values([
        { title: "R done", horizon: "daily", status: "done", dueDate: "2026-11-10" },
        { title: "R open late", horizon: "upcoming", dueDate: "2026-11-01" },
        { title: "R open this week", horizon: "daily", dueDate: "2026-11-12" },
        { title: "R next week", horizon: "upcoming", dueDate: "2026-11-18" },
        { title: "R habit", horizon: "daily", recurrence: "daily", dueDate: "2026-11-01" },
      ])
      .returning();
    await db.insert(schema.taskCompletions).values([
      { taskId: doneTask.id, day: "2026-11-10" },
      { taskId: habit.id, day: "2026-11-10" },
      { taskId: habit.id, day: "2026-11-11" },
    ]);
    await db.insert(schema.attendance).values([{ day: "2026-11-10" }, { day: "2026-11-11" }]);
    await db.insert(schema.journal).values([{ day: "2026-11-10", mood: 4 }, { day: "2026-11-11", mood: 5 }]);
    await db.insert(schema.settings).values({ key: reviewKey("2026-11-02"), value: { wins: "", blockers: "", focus: "", reviewedAt: "2026-11-08T10:00:00Z" } });

    const r = await getWeekReview(week, "2026-11-14");
    expect(r.done.map((d) => d.title)).toContain("R done");
    expect(r.habits.find((h) => h.title === "R habit")?.done).toBe(2);
    const carry = r.carryOver.map((t) => t.title);
    expect(carry).toEqual(expect.arrayContaining(["R open late", "R open this week"]));
    expect(carry).not.toContain("R next week");
    expect(r.nextWeek.map((t) => t.title)).toContain("R next week");
    expect(r.stats.daysPresent).toBe(2);
    expect(r.stats.mood).toBe(4.5);
    expect(r.streak).toBe(1);
    expect(openLate.id && openThisWeek.id && nextWeek.id).toBeTruthy();
  });

  it("moves one carry-over, then the rest, to next Monday", async () => {
    const before = await getWeekReview(week, "2026-11-14");
    const first = before.carryOver[0];
    expect(await moveTasksToNextWeek(week, first.id)).toBe(1);
    const after = await getWeekReview(week, "2026-11-14");
    expect(after.carryOver.find((t) => t.id === first.id)).toBeUndefined();
    expect(after.nextWeek.find((t) => t.id === first.id)?.dueDate).toBe("2026-11-16");

    await moveTasksToNextWeek(week);
    expect((await getWeekReview(week, "2026-11-14")).carryOver).toHaveLength(0);
  });
});
