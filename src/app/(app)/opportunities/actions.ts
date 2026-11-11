"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { opportunities } from "@/db/schema";
import { failure, firstIssue, formFields, optionalDay, optionalText, requiredText, uuid, type ActionResult } from "@/lib/actions";
import { requireSession } from "@/lib/auth/require-session";
import { OPP_STATUSES } from "@/lib/queries/opportunities";
import { normalizeUrl } from "@/lib/url";

function refresh() {
  revalidatePath("/opportunities", "layout");
  revalidatePath("/");
  revalidatePath("/insights");
}

const OppInput = z.object({
  name: requiredText(200, "Name the opportunity."),
  type: optionalText(60),
  status: z.enum(OPP_STATUSES).default("inbox"),
  link: z
    .string()
    .max(4096)
    .optional()
    .transform((v) => (v?.trim() ? normalizeUrl(v) : null)),
  deadline: optionalDay,
  nextAction: optionalText(300),
  notes: optionalText(10_000),
});

const FIELDS = ["name", "type", "status", "link", "deadline", "nextAction", "notes"] as const;

export async function saveOpportunity(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireSession();
  const parsed = OppInput.safeParse(formFields(fd, FIELDS));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const id = formFields(fd, ["id"]).id;
  try {
    const db = await getDb();
    if (id && uuid.safeParse(id).success) {
      await db.update(opportunities).set({ ...parsed.data, updatedAt: new Date() }).where(eq(opportunities.id, id));
      refresh();
      return { ok: true, id, message: "Saved." };
    }
    const [row] = await db.insert(opportunities).values(parsed.data).returning({ id: opportunities.id });
    refresh();
    return { ok: true, id: row.id, message: `Added “${parsed.data.name}”.` };
  } catch (err) {
    return failure("saveOpportunity", err);
  }
}

export async function moveOpportunity(id: string, status: string): Promise<void> {
  await requireSession();
  const parsed = z.object({ id: uuid, status: z.enum(OPP_STATUSES) }).safeParse({ id, status });
  if (!parsed.success) return;
  const db = await getDb();
  await db.update(opportunities).set({ status: parsed.data.status, updatedAt: new Date() }).where(eq(opportunities.id, parsed.data.id));
  refresh();
}

export async function deleteOpportunity(id: string): Promise<void> {
  await requireSession();
  if (!uuid.safeParse(id).success) return;
  const db = await getDb();
  await db.delete(opportunities).where(eq(opportunities.id, id));
  refresh();
  redirect("/opportunities");
}
