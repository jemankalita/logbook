"use server";

import { count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { paths } from "@/db/schema";
import { failure, formFields, optionalText, uuid, type ActionResult } from "@/lib/actions";
import { requireSession } from "@/lib/auth/require-session";
import { docToText, parseDocJson } from "@/lib/rich-text";

function refresh() {
  revalidatePath("/paths", "layout");
  revalidatePath("/tasks");
}

const Meta = z.object({
  name: z
    .string()
    .max(120)
    .optional()
    .transform((v) => v?.trim() || "Untitled path"),
  emoji: optionalText(16),
  description: optionalText(500),
});

export async function createPath(fd: FormData): Promise<void> {
  await requireSession();
  const data = Meta.parse(formFields(fd, ["name", "emoji", "description"]));
  const db = await getDb();
  const [{ n }] = await db.select({ n: count() }).from(paths);
  const [row] = await db.insert(paths).values({ ...data, position: Number(n) }).returning({ id: paths.id });
  refresh();
  redirect(`/paths/${row.id}`);
}

export async function updatePathMeta(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireSession();
  const id = formFields(fd, ["id"]).id;
  if (!id || !uuid.safeParse(id).success) return { ok: false, error: "Unknown path." };
  const parsed = Meta.omit({ name: true }).safeParse(formFields(fd, ["emoji", "description"]));
  if (!parsed.success) return { ok: false, error: "Check the fields and try again." };
  try {
    const db = await getDb();
    await db.update(paths).set({ ...parsed.data, updatedAt: new Date() }).where(eq(paths.id, id));
    refresh();
    return { ok: true, message: "Saved." };
  } catch (err) {
    return failure("updatePathMeta", err);
  }
}

export async function renamePath(id: string, name: string): Promise<ActionResult> {
  await requireSession();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Unknown path." };
  try {
    const db = await getDb();
    await db.update(paths).set({ name: (typeof name === "string" ? name.trim().slice(0, 120) : "") || "Untitled path", updatedAt: new Date() }).where(eq(paths.id, id));
    refresh();
    return { ok: true };
  } catch (err) {
    return failure("renamePath", err);
  }
}

export async function savePathBody(id: string, json: string): Promise<ActionResult> {
  await requireSession();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Unknown path." };
  const doc = parseDocJson(json);
  if (!doc) return { ok: false, error: "That content couldn't be saved." };
  try {
    const db = await getDb();
    await db.update(paths).set({ body: doc, bodyText: docToText(doc).slice(0, 200_000), updatedAt: new Date() }).where(eq(paths.id, id));
    return { ok: true };
  } catch (err) {
    return failure("savePathBody", err);
  }
}

/** Deletes the path; its tasks are kept (they just lose the link). */
export async function deletePath(id: string): Promise<void> {
  await requireSession();
  if (!uuid.safeParse(id).success) return;
  const db = await getDb();
  await db.delete(paths).where(eq(paths.id, id));
  refresh();
  redirect("/paths");
}
