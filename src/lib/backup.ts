import { timingSafeEqual } from "node:crypto";
import type { PgTable } from "drizzle-orm/pg-core";
import type { Db } from "@/db/client";
import {
  attendance,
  folders,
  importMap,
  items,
  itemTags,
  journal,
  listEntries,
  lists,
  opportunities,
  paths,
  settings,
  tags,
  taskCompletions,
  tasks,
  timeBlocks,
} from "@/db/schema";

export const BACKUP_VERSION = 1;
/** The automated backup's bearer token must be long and random (see README → Backups). */
export const MIN_BACKUP_TOKEN_LENGTH = 32;

/** Every table worth keeping. `login_attempts` is throwaway rate-limit state, so it's left out. */
const TABLES = {
  folders,
  items,
  tags,
  item_tags: itemTags,
  paths,
  tasks,
  task_completions: taskCompletions,
  time_blocks: timeBlocks,
  opportunities,
  lists,
  list_entries: listEntries,
  journal,
  attendance,
  settings,
  import_map: importMap,
} satisfies Record<string, PgTable>;

export type BackupTable = keyof typeof TABLES;
export const BACKUP_TABLES = Object.keys(TABLES) as BackupTable[];

export interface Backup {
  app: "logbook";
  version: number;
  exportedAt: string;
  tables: Record<BackupTable, unknown[]>;
}

export async function buildBackup(db: Db): Promise<Backup> {
  const entries = await Promise.all(BACKUP_TABLES.map(async (name) => [name, await db.select().from(TABLES[name] as PgTable)] as const));
  return {
    app: "logbook",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tables: Object.fromEntries(entries) as Record<BackupTable, unknown[]>,
  };
}

/**
 * `Authorization: Bearer <token>` against BACKUP_TOKEN, in constant time.
 * Disabled (always false) unless a long enough token is configured.
 */
export function isBackupTokenValid(header: string | null, expected: string | undefined): boolean {
  if (!expected || expected.length < MIN_BACKUP_TOKEN_LENGTH || !header?.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice("Bearer ".length));
  const want = Buffer.from(expected);
  return given.length === want.length && timingSafeEqual(given, want);
}
