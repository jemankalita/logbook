import { mkdir } from "node:fs/promises";
import path from "node:path";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { waitUntil } from "@vercel/functions";
import { createIdleRelease, type IdleRelease } from "./idle-release";
import * as schema from "./schema";

/**
 * One query API for both databases:
 * - DATABASE_URL set  → Supabase / any Postgres (production)
 * - DATABASE_URL unset → embedded PGlite in .data/pglite (local dev, zero setup)
 *
 * The PGlite and postgres-js Drizzle instances expose the same query builder,
 * so we type both as the postgres-js variant.
 */
export type Db = PostgresJsDatabase<typeof schema>;

interface CachedDb {
  db: Promise<Db>;
  /** Production only: closes the pool after it goes idle (see idle-release.ts). */
  release?: IdleRelease;
  close?: () => Promise<void>;
}

const globalForDb = globalThis as unknown as { __logbookDb?: CachedDb };

// Supabase's session pooler (port 5432) caps clients at 15 on the free tier. Pages run
// several queries at once, so each instance gets a few connections — and closes them all
// once it goes quiet, so frozen or recycled instances never strand any. (The transaction
// pooler on 6543 is not used: postgres-js pipelines queries there and requests hang.)
const POOL_MAX = 5;
const IDLE_RELEASE_MS = 20_000;
const CLOSE_GRACE_S = 5;
const CONNECT_TIMEOUT_S = 10;

function createPostgresDb(url: string): CachedDb {
  const client = postgres(url, {
    prepare: false,
    max: POOL_MAX,
    idle_timeout: IDLE_RELEASE_MS / 1000,
    connect_timeout: CONNECT_TIMEOUT_S,
  });
  const close = async () => {
    if (globalForDb.__logbookDb === entry) globalForDb.__logbookDb = undefined;
    await client.end({ timeout: CLOSE_GRACE_S });
  };
  const release = createIdleRelease(close, IDLE_RELEASE_MS, waitUntil);
  // Every statement counts as use, so long jobs (imports) that hold `db` keep the pool open.
  const db = drizzlePostgres(client, { schema, logger: { logQuery: () => release.touch() } });
  const entry: CachedDb = { db: Promise.resolve(db), release, close };
  return entry;
}

async function createLocalDb(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");

  const dataDir = path.join(process.cwd(), ".data", "pglite");
  // PGlite only creates the leaf directory, not its parents.
  await mkdir(path.dirname(dataDir), { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  try {
    await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  } catch (err) {
    // Release the data-dir lock so a retry doesn't open a second instance on it.
    await client.close();
    throw err;
  }
  // Safe only because app code sticks to the query builder. Avoid `db.execute()`:
  // it returns rows[] on postgres-js but { rows } on PGlite.
  return db as unknown as Db;
}

function createDb(): CachedDb {
  const url = process.env.DATABASE_URL;
  if (url) return createPostgresDb(url);
  if (process.env.VERCEL) {
    throw new Error("DATABASE_URL is not set. Add your Supabase connection string in Vercel → Settings → Environment Variables.");
  }
  const entry: CachedDb = {
    db: createLocalDb().catch((err: unknown) => {
      // Don't cache a failed connection — let the next request retry.
      if (globalForDb.__logbookDb === entry) globalForDb.__logbookDb = undefined;
      throw err;
    }),
  };
  return entry;
}

/** Tests: point getDb() at an in-memory database (or clear it with undefined). */
export function setDbForTests(db: Db | undefined): void {
  globalForDb.__logbookDb = db ? { db: Promise.resolve(db) } : undefined;
}

export function getDb(): Promise<Db> {
  let cached = globalForDb.__logbookDb;
  // The idle timer never ran (the instance was frozen): its sockets are likely dead, so start fresh.
  if (cached?.release?.isStale()) {
    void cached.close?.().catch((err: unknown) => console.error("[db] closing stale pool failed", err));
    cached = undefined;
  }
  if (!cached) {
    cached = createDb();
    globalForDb.__logbookDb = cached;
  }
  cached.release?.touch();
  return cached.db;
}
