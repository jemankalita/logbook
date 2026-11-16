import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  // Only needed for `npm run db:migrate` against Supabase.
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
