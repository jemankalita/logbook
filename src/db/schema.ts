import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/* ── Library ─────────────────────────────────────────────── */

export const folders = pgTable(
  "folders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    emoji: text("emoji"),
    color: text("color"),
    parentId: uuid("parent_id").references((): AnyPgColumn => folders.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("folders_parent_idx").on(t.parentId)],
);

export const itemKind = pgEnum("item_kind", ["link", "note", "list_item", "person"]);
export const itemStatus = pgEnum("item_status", ["unread", "read", "done"]);
export const itemType = pgEnum("item_type", ["article", "course", "video", "tool", "idea", "note", "tweet", "other"]);

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    folderId: uuid("folder_id").references(() => folders.id, { onDelete: "set null" }),
    kind: itemKind("kind").notNull().default("link"),
    type: itemType("type").notNull().default("other"),
    url: text("url"),
    title: text("title").notNull(),
    summary: text("summary"),
    description: text("description"),
    image: text("image"),
    favicon: text("favicon"),
    body: jsonb("body"),
    status: itemStatus("status").notNull().default("unread"),
    starred: boolean("starred").notNull().default(false),
    actionable: boolean("actionable").notNull().default(false),
    deadline: date("deadline"),
    /** where it came from: "notion" | "chrome" | "x" | "web" | "manual" */
    source: text("source"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("items_folder_idx").on(t.folderId), index("items_created_idx").on(t.createdAt)],
);

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  color: text("color"),
});

export const itemTags = pgTable(
  "item_tags",
  {
    itemId: uuid("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.tagId] })],
);

/* ── Tasks ───────────────────────────────────────────────── */

export const taskHorizon = pgEnum("task_horizon", ["daily", "upcoming", "roadmap"]);
export const taskStatus = pgEnum("task_status", ["not_started", "in_progress", "done"]);
export const priority = pgEnum("priority", ["high", "medium", "low"]);
export const effort = pgEnum("effort", ["small", "medium", "large"]);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description"),
    horizon: taskHorizon("horizon").notNull().default("daily"),
    status: taskStatus("status").notNull().default("not_started"),
    priority: priority("priority"),
    effort: effort("effort"),
    area: text("area"),
    parentId: uuid("parent_id").references((): AnyPgColumn => tasks.id, { onDelete: "cascade" }),
    dueDate: date("due_date"),
    /** null = one-off; "daily" | "weekdays" | "weekly" for habits */
    recurrence: text("recurrence"),
    doneAt: timestamp("done_at", { withTimezone: true }),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("tasks_horizon_idx").on(t.horizon), index("tasks_done_idx").on(t.doneAt)],
);

/** One row per (task, day) it was completed — keeps history for recurring habits. */
export const taskCompletions = pgTable(
  "task_completions",
  {
    taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.day] }), index("task_completions_day_idx").on(t.day)],
);

export const timeBlocks = pgTable(
  "time_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    area: text("area"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    done: boolean("done").notNull().default(false),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [index("time_blocks_start_idx").on(t.startsAt)],
);

/* ── Opportunities & Paths ───────────────────────────────── */

export const oppStatus = pgEnum("opp_status", [
  "inbox",
  "interested",
  "applying",
  "submitted",
  "interview",
  "result",
  "closed",
]);

export const opportunities = pgTable("opportunities", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: text("type"),
  status: oppStatus("status").notNull().default("inbox"),
  link: text("link"),
  deadline: date("deadline"),
  nextAction: text("next_action"),
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const paths = pgTable("paths", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  emoji: text("emoji"),
  body: jsonb("body"),
  position: integer("position").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* ── Journal, attendance, settings ──────────────────────── */

export const journal = pgTable("journal", {
  day: date("day").primaryKey(),
  body: jsonb("body"),
  updatedAt: updatedAt(),
});

/** Daily attendance: one row = "I showed up that day". */
export const attendance = pgTable("attendance", {
  day: date("day").primaryKey(),
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }).notNull().defaultNow(),
  note: text("note"),
});

/** Login throttling shared across serverless instances. key = "ip:<addr>" | "global". */
export const loginAttempts = pgTable("login_attempts", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});
