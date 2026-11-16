"use server";

import { count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { listEntries, lists } from "@/db/schema";
import { failure, firstIssue, formFields, optionalText, requiredText, uuid, type ActionResult } from "@/lib/actions";
import { requireSession } from "@/lib/auth/require-session";
import { normalizeUrl } from "@/lib/url";

function refresh() {
  revalidatePath("/lists", "layout");
}

const ListInput = z.object({
  name: requiredText(80, "Name the list."),
  emoji: optionalText(16),
  kind: z.enum(["watchlist", "people", "generic"]).default("generic"),
});

export async function createList(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireSession();
  const parsed = ListInput.safeParse(formFields(fd, ["name", "emoji", "kind"]));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  let id: string;
  try {
    const db = await getDb();
    const [{ n }] = await db.select({ n: count() }).from(lists);
    [{ id }] = await db.insert(lists).values({ ...parsed.data, position: Number(n) }).returning({ id: lists.id });
  } catch (err) {
    return failure("createList", err);
  }
  refresh();
  redirect(`/lists/${id}`);
}

export async function updateList(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireSession();
  const parsed = ListInput.extend({ id: uuid }).safeParse(formFields(fd, ["id", "name", "emoji", "kind"]));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { id, ...data } = parsed.data;
  try {
    const db = await getDb();
    await db.update(lists).set(data).where(eq(lists.id, id));
    refresh();
    return { ok: true, message: "Saved." };
  } catch (err) {
    return failure("updateList", err);
  }
}

export async function deleteList(id: string): Promise<void> {
  await requireSession();
  if (!uuid.safeParse(id).success) return;
  const db = await getDb();
  await db.delete(lists).where(eq(lists.id, id));
  refresh();
  redirect("/lists");
}

const EntryInput = z.object({
  title: requiredText(300, "Give it a name."),
  subtitle: optionalText(200),
  url: z
    .string()
    .max(4096)
    .optional()
    .transform((v) => (v?.trim() ? normalizeUrl(v) : null)),
  notes: optionalText(5_000),
  status: z.enum(["todo", "doing", "done"]).default("todo"),
  rating: z
    .string()
    .optional()
    .transform((v) => {
      const n = Number(v);
      return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
    }),
});

const ENTRY_FIELDS = ["title", "subtitle", "url", "notes", "status", "rating"] as const;

export async function saveEntry(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireSession();
  const parsed = EntryInput.safeParse(formFields(fd, ENTRY_FIELDS));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { id, listId } = formFields(fd, ["id", "listId"]);
  try {
    const db = await getDb();
    if (id && uuid.safeParse(id).success) {
      await db.update(listEntries).set({ ...parsed.data, updatedAt: new Date() }).where(eq(listEntries.id, id));
    } else if (listId && uuid.safeParse(listId).success) {
      await db.insert(listEntries).values({ ...parsed.data, listId });
    } else {
      return { ok: false, error: "Unknown list." };
    }
    refresh();
    return { ok: true, message: "Saved." };
  } catch (err) {
    return failure("saveEntry", err);
  }
}

export async function setEntryStatus(id: string, status: string): Promise<void> {
  await requireSession();
  const parsed = z.object({ id: uuid, status: z.enum(["todo", "doing", "done"]) }).safeParse({ id, status });
  if (!parsed.success) return;
  const db = await getDb();
  await db.update(listEntries).set({ status: parsed.data.status, updatedAt: new Date() }).where(eq(listEntries.id, parsed.data.id));
  refresh();
}

export async function deleteEntry(id: string): Promise<void> {
  await requireSession();
  if (!uuid.safeParse(id).success) return;
  const db = await getDb();
  await db.delete(listEntries).where(eq(listEntries.id, id));
  refresh();
}
