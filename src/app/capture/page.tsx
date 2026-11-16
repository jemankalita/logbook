import { LogoMark } from "@/components/brand";
import { cls } from "@/components/cls";
import { requirePageSession } from "@/lib/auth/require-session";
import { flattenTree, getFolderTree } from "@/lib/queries/library";
import { normalizeUrl } from "@/lib/url";
import { CaptureForm } from "./capture-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Save · Logbook" };

const URL_IN_TEXT = /https?:\/\/[^\s<>"']+/i;

/**
 * Landing page for the bookmarklet, the Chrome extension and the phone share sheet.
 * It only pre-fills a form — nothing is saved until you press Save (so a link to
 * this page can't save things on your behalf).
 */
export default async function CapturePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageSession();
  const sp = await searchParams;
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v)?.slice(0, 5_000) ?? "";
  };
  const text = one("text");
  const rawUrl = one("url") || URL_IN_TEXT.exec(text)?.[0] || "";
  const url = rawUrl ? (normalizeUrl(rawUrl) ?? "") : "";
  const remainingText = url ? text.replace(rawUrl, "").trim() : text;

  const folders = flattenTree(await getFolderTree()).map((f) => ({ id: f.id, label: `${"  ".repeat(f.depth)}${f.emoji ? `${f.emoji} ` : ""}${f.name}` }));

  return (
    <main className="rise mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 py-8">
      <header className="flex items-center gap-3">
        <LogoMark className="size-9" />
        <div>
          <p className={cls.eyebrow}>Logbook</p>
          <h1 className="font-display text-[1.75rem] leading-none tracking-[-0.01em]">Save a link</h1>
        </div>
      </header>
      <div className={`${cls.card} p-5`}>
        <CaptureForm url={url} title={one("title")} text={remainingText} folders={folders} />
      </div>
    </main>
  );
}
