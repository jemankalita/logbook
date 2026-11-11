import Link from "next/link";
import { headers } from "next/headers";
import { and, count, eq, isNull } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { getDb } from "@/db/client";
import { items } from "@/db/schema";
import { cls } from "@/components/cls";
import { BookmarkletLink, EnrichRunner, ImportForm } from "./import-tools";

export const dynamic = "force-dynamic";
export const metadata = { title: "Import · Library · Logbook" };

async function missingPreviews(): Promise<number> {
  const db = await getDb();
  const [row] = await db.select({ n: count() }).from(items).where(and(eq(items.kind, "link"), isNull(items.previewFetchedAt)));
  return Number(row?.n ?? 0);
}

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className={`${cls.card} flex flex-col gap-3 p-5`}>
      <h2 className="flex items-center gap-2 font-medium">
        <span className="grid size-6 place-items-center rounded-full bg-panel-2 text-xs tabular">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function ImportPage() {
  const [remaining, origin] = await Promise.all([missingPreviews(), siteOrigin()]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <Link href="/library" className={`${cls.btnGhost} self-start`}>
        <ArrowLeft className="size-4" aria-hidden /> Library
      </Link>
      <h1 className={cls.h1}>Import &amp; capture tools</h1>

      <Step n={1} title="Import Chrome bookmarks">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>
            In Chrome open <span className="text-fg">Bookmarks Manager</span> (Ctrl + Shift + O).
          </li>
          <li>
            Click <span className="text-fg">⋮ → Export bookmarks</span> and save the .html file.
          </li>
          <li>Choose it below. Your folders (ai, hackathons, cf resources, …) become Library folders. Running it again skips links you already have.</li>
        </ol>
        <ImportForm />
      </Step>

      <Step n={2} title="Fill in preview cards">
        <EnrichRunner initialRemaining={remaining} />
      </Step>

      <Step n={3} title="Save from any page: bookmarklet">
        <p className="text-sm text-muted">
          Drag this button to your bookmarks bar. On any page, click it to save that page (and any text you&apos;ve selected) to your Library.
        </p>
        <BookmarkletLink origin={origin} />
      </Step>

      <section className={`${cls.card} p-5 text-sm text-muted`}>
        <h2 className="mb-2 font-medium text-fg">Other ways to save</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <kbd className="rounded border border-line px-1">Ctrl</kbd>+<kbd className="rounded border border-line px-1">K</kbd> anywhere in Logbook → paste a link.
          </li>
          <li>
            The <span className="text-fg">Chrome extension</span> in the <code>extension/</code> folder: right-click any page or link → “Save to Logbook”.
          </li>
          <li>
            On your phone: install Logbook (browser menu → <span className="text-fg">Add to Home screen</span>), then share any link to <span className="text-fg">Logbook</span>.
          </li>
        </ul>
      </section>
    </div>
  );
}
