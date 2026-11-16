import { z } from "zod";

/** Shared shape for server-action results shown in forms. */
export type ActionResult = { ok: true; message?: string; id?: string } | { ok: false; error: string };

export const uuid = z.uuid();

/** Optional text field: trims, turns "" into null, enforces a max length. */
export const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => {
      const t = v?.trim();
      return t ? t : null;
    });

export const requiredText = (max: number, message = "This field is required.") => z.string().trim().min(1, message).max(max);

/** "YYYY-MM-DD" or empty → null. */
export const optionalDay = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null));

/** Read FormData into a plain object (missing keys stay undefined, files are dropped). */
export function formFields(fd: FormData, keys: readonly string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const key of keys) {
    const value = fd.get(key);
    out[key] = typeof value === "string" ? value : undefined;
  }
  return out;
}

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

/** Escape LIKE wildcards in user search input. */
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** "ai, #ml, Ideas" → ["ai", "ml", "ideas"] (deduped, max 20, 40 chars each). */
export function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const names = raw
    .split(/[,#\n]/)
    .map((t) => t.trim().toLowerCase().slice(0, 40))
    .filter(Boolean);
  return [...new Set(names)].slice(0, 20);
}

/** Only same-site relative paths (blocks open redirects through form fields). */
export function safeReturnPath(path: string | null | undefined, fallback: string): string {
  return path && path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") ? path : fallback;
}

/** Log the real error server-side, return a safe message to the page. */
export function failure(scope: string, err: unknown, message = "Something went wrong. Try again."): ActionResult {
  console.error(`[${scope}]`, err);
  return { ok: false, error: message };
}
