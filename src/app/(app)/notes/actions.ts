"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { items } from "@/db/schema";
import { failure, uuid, type ActionResult } from "@/lib/actions";
import { requireSession } from "@/lib/auth/require-session";
import { docToText, parseDocJson } from "@/lib/rich-text";

const isNote = (id: string) => and(eq(items.id, id), eq(items.kind, "note"));

export async function createNote(): Promise<void> {
  await requireSession();
  const db = await getDb();
  const [row] = await db.insert(items).values({ kind: "note", type: "note", title: "Untitled", source: "manual" }).returning({ id: items.id });
  revalidatePath("/notes");
  redirect(`/notes/${row.id}`);
}

export async function saveNoteBody(id: string, json: string): Promise<ActionResult> {
  await requireSession();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Unknown note." };
  const doc = parseDocJson(json);
  if (!doc) return { ok: false, error: "That content couldn't be saved." };
  try {
    const db = await getDb();
    await db.update(items).set({ body: doc, bodyText: docToText(doc).slice(0, 200_000), updatedAt: new Date() }).where(isNote(id));
    revalidatePath("/notes");
    return { ok: true };
  } catch (err) {
    return failure("saveNoteBody", err);
  }
}

export async function renameNote(id: string, title: string): Promise<ActionResult> {
  await requireSession();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Unknown note." };
  const clean = typeof title === "string" ? title.trim().slice(0, 300) : "";
  try {
    const db = await getDb();
    await db.update(items).set({ title: clean || "Untitled", updatedAt: new Date() }).where(isNote(id));
    revalidatePath("/notes");
    return { ok: true };
  } catch (err) {
    return failure("renameNote", err);
  }
}

export async function toggleNotePin(id: string): Promise<void> {
  await requireSession();
  if (!uuid.safeParse(id).success) return;
  const db = await getDb();
  const [row] = await db.select({ starred: items.starred }).from(items).where(isNote(id)).limit(1);
  if (!row) return;
  await db.update(items).set({ starred: !row.starred }).where(isNote(id));
  revalidatePath("/notes", "layout");
}

export async function deleteNote(id: string): Promise<void> {
  await requireSession();
  if (!uuid.safeParse(id).success) return;
  const db = await getDb();
  await db.delete(items).where(isNote(id));
  revalidatePath("/notes");
  redirect("/notes");
}
