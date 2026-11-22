import { mkdir } from "node:fs/promises";
import path from "node:path";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
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

const globalForDb = globalThis as unknown as { __logbookDb?: Promise<Db> };

// Supabase's session pooler (port 5432) caps clients at the pool size (15 on the
// free tier). Serverless instances each hold their own pool, so keep it tiny and
// hand idle connections back quickly. (The transaction pooler on 6543 is not used:
// postgres-js pipelines queries, which it doesn't handle, and requests hang.)
const POOL_MAX = 2;
const IDLE_TIMEOUT_S = 15;
const CONNECT_TIMEOUT_S = 10;

async function createPostgresDb(url: string): Promise<Db> {
  const client = postgres(url, {
    prepare: false,
    max: POOL_MAX,
    idle_timeout: IDLE_TIMEOUT_S,
    connect_timeout: CONNECT_TIMEOUT_S,
  });
  return drizzlePostgres(client, { schema });
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

async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) return createPostgresDb(url);
  if (process.env.VERCEL) {
    throw new Error("DATABASE_URL is not set. Add your Supabase connection string in Vercel → Settings → Environment Variables.");
  }
  return createLocalDb();
}

export function getDb(): Promise<Db> {
  if (!globalForDb.__logbookDb) {
    globalForDb.__logbookDb = createDb().catch((err: unknown) => {
      // Don't cache a failed connection — let the next request retry.
      globalForDb.__logbookDb = undefined;
      throw err;
    });
  }
  return globalForDb.__logbookDb;
}
