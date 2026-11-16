"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cls } from "@/components/cls";
import { DATABASE_KINDS, SOURCE_KIND_LABELS, SOURCE_KINDS, type SourceKind } from "@/lib/import/notion/convert";
import type { NotionSource } from "@/lib/import/notion/importer";
import { importNotionChunk, scanNotion } from "./notion-actions";
import { Emoji } from "@/components/emoji";

type RowState = { status: "pending" | "running" | "done" | "error"; added: number; skipped: number; failed: number; cursor: string | null; error?: string };

const PAGE_KINDS = SOURCE_KINDS.filter((k) => !DATABASE_KINDS.includes(k));
const DB_KINDS = SOURCE_KINDS.filter((k) => DATABASE_KINDS.includes(k) || k === "skip");

function Progress({ row, skip }: { row: RowState | undefined; skip: boolean }) {
  if (row?.status === "done") return <span className="text-fg">✓ {row.added}</span>;
  if (row?.status === "running") return <span className="text-accent">{row.added}…</span>;
  if (skip) return <span className="text-muted">—</span>;
  return <span className="text-muted">{row?.added || ""}</span>;
}

export function NotionImport({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [sources, setSources] = useState<NotionSource[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [scanning, setScanning] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stop = useRef(false);

  async function scan() {
    setScanning(true);
    setError(null);
    const res = await scanNotion();
    setScanning(false);
    if (!res.ok) return setError(res.error);
    setSources(res.sources);
    setTruncated(res.truncated);
    setRows(Object.fromEntries(res.sources.map((s) => [s.id, { status: "pending", added: 0, skipped: 0, failed: 0, cursor: null }])));
  }

  const setKind = (id: string, kind: SourceKind) => setSources((list) => list?.map((s) => (s.id === id ? { ...s, kind } : s)) ?? null);
  const patch = (id: string, p: Partial<RowState>) => setRows((r) => ({ ...r, [id]: { ...r[id], ...p } }));

  /** Import one source chunk by chunk. Returns false if it stopped on an error. */
  async function importSource(s: NotionSource, start: RowState): Promise<boolean> {
    let { cursor, added, skipped, failed } = start;
    patch(s.id, { status: "running", error: undefined });
    while (!stop.current) {
      const res = await importNotionChunk(s, cursor);
      if (!res.ok) {
        patch(s.id, { status: "error", error: res.error, cursor });
        setError(`Stopped at “${s.title}”. Fix the problem (or set it to Skip) and press Continue.`);
        return false;
      }
      added += res.added;
      skipped += res.skipped;
      failed += res.failed;
      cursor = res.nextCursor;
      patch(s.id, { status: cursor ? "running" : "done", added, skipped, failed, cursor });
      if (!cursor) return true;
    }
    patch(s.id, { status: "pending", cursor, added, skipped, failed });
    return true;
  }

  async function run() {
    if (!sources) return;
    setRunning(true);
    setError(null);
    stop.current = false;
    for (const s of sources) {
      if (stop.current) break;
      const row = rows[s.id];
      if (s.kind === "skip" || row?.status === "done") continue;
      if (!(await importSource(s, row))) break;
    }
    setRunning(false);
    router.refresh();
  }

  if (!configured) {
    return (
      <p className="rounded-lg border border-dashed border-line p-3 text-sm text-muted">
        Not connected yet — add <code className="text-fg">NOTION_TOKEN</code> and <code className="text-fg">NOTION_ROOT_PAGE</code> to your environment (steps above), restart, then come back.
      </p>
    );
  }

  const total = sources?.reduce((n, s) => n + (rows[s.id]?.added ?? 0), 0) ?? 0;
  const allDone = sources?.every((s) => s.kind === "skip" || rows[s.id]?.status === "done");

  return (
    <div className="flex flex-col gap-3">
      {!sources ? (
        <button type="button" onClick={scan} disabled={scanning} className={`${cls.btnPrimary} self-start`}>
          {scanning ? "Reading your Notion…" : "Scan my Notion"}
        </button>
      ) : (
        <>
          <p className="text-sm text-muted">Found {sources.length} databases and pages. Check where each one should go, then import. Anything already imported is skipped, so it&apos;s safe to run again.</p>
          {truncated ? (
            <p role="status" className="rounded-lg border border-line bg-panel-2 p-2 text-xs text-muted">
              Some Notion pages were too long to scan completely, so a few databases may be missing from this list. Sub-pages nested two levels deep aren&apos;t scanned either — connect the integration to those pages and set NOTION_ROOT_PAGE to them for a second pass.
            </p>
          ) : null}
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-panel-2 text-left text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">In Notion</th>
                  <th className="px-3 py-2 font-medium">Becomes</th>
                  <th className="px-3 py-2 text-right font-medium">Imported</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => {
                  const r = rows[s.id];
                  return (
                    <tr key={s.id} className="border-t border-line align-top">
                      <td className="px-3 py-2">
                        <Emoji char={s.isDatabase ? "🗂" : "📄"} size="1rem" className="mr-1.5" />
                        {s.title}
                        {s.parent ? <span className="block text-xs text-muted">inside {s.parent}</span> : null}
                        {r?.error ? <span className="mt-1 block text-xs text-danger">{r.error}</span> : null}
                      </td>
                      <td className="px-3 py-2">
                        <label className="sr-only" htmlFor={`kind-${s.id}`}>
                          Import “{s.title}” as
                        </label>
                        <select id={`kind-${s.id}`} value={s.kind} disabled={running || r?.status === "done"} onChange={(e) => setKind(s.id, e.target.value as SourceKind)} className={`${cls.select} h-8 text-xs`}>
                          {(s.isDatabase ? DB_KINDS : PAGE_KINDS).map((k) => (
                            <option key={k} value={k}>
                              {SOURCE_KIND_LABELS[k]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="tabular px-3 py-2 text-right text-xs">
                        <Progress row={r} skip={s.kind === "skip"} />
                        {r?.skipped ? <span className="block text-muted">{r.skipped} skipped</span> : null}
                        {r?.failed ? <span className="block text-danger">{r.failed} failed — run again to retry</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {allDone ? (
              <p className="text-sm">Done — {total} things imported. ✓</p>
            ) : (
              <button type="button" onClick={run} disabled={running} className={cls.btnPrimary}>
                {running ? "Importing…" : total > 0 ? "Continue import" : "Import everything"}
              </button>
            )}
            {running ? (
              <button type="button" onClick={() => (stop.current = true)} className={cls.btnGhost}>
                Pause
              </button>
            ) : null}
            <p aria-live="polite" className="text-sm text-muted">
              {running ? `${total} imported so far…` : ""}
            </p>
          </div>
        </>
      )}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
