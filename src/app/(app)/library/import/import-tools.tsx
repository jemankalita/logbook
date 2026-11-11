"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cls, FormMessage, SubmitButton } from "@/components/ui";
import { enrichPreviews, importChromeBookmarks } from "../actions";

export function ImportForm() {
  const [state, action] = useActionState(importChromeBookmarks, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className={cls.label} htmlFor="bm-file">
        Exported bookmarks file (.html)
      </label>
      <input
        id="bm-file"
        name="file"
        type="file"
        accept=".html,.htm,text/html"
        required
        className="text-sm text-muted file:mr-3 file:h-9 file:rounded-lg file:border file:border-line file:bg-panel-2 file:px-3 file:text-sm file:text-fg"
      />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Importing…">Import bookmarks</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

/** Repeatedly asks the server to fetch preview cards for links that don't have one yet. */
export function EnrichRunner({ initialRemaining }: { initialRemaining: number }) {
  const router = useRouter();
  const [remaining, setRemaining] = useState(initialRemaining);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stop = useRef(false);

  useEffect(() => setRemaining(initialRemaining), [initialRemaining]);
  useEffect(() => () => void (stop.current = true), []);

  async function run() {
    setRunning(true);
    setError(null);
    stop.current = false;
    try {
      for (;;) {
        if (stop.current) break;
        const res = await enrichPreviews();
        setRemaining(res.remaining);
        if (res.processed === 0 || res.remaining === 0) break;
      }
      router.refresh();
    } catch {
      setError("Stopped because of an error. Press the button to continue.");
    } finally {
      setRunning(false);
    }
  }

  if (remaining === 0 && !running) return <p className="text-sm text-muted">Every link has a preview card. ✓</p>;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">
        <span className="tabular font-medium">{remaining}</span> links still need a preview card (image + description).
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={run} disabled={running} className={cls.btnPrimary}>
          {running ? "Fetching previews…" : "Fetch previews"}
        </button>
        {running ? (
          <button type="button" onClick={() => (stop.current = true)} className={cls.btn}>
            Pause
          </button>
        ) : null}
      </div>
      <p className="text-xs text-muted">About 12 links per round. Keep this tab open; you can pause and resume any time.</p>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Drag-to-bookmarks-bar link. React blocks `javascript:` hrefs in JSX,
 * so the href is set on the DOM node after mount.
 */
export function BookmarkletLink({ origin }: { origin: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const code = `javascript:(()=>{const u=encodeURIComponent(location.href),t=encodeURIComponent(document.title),s=encodeURIComponent(String(getSelection()).slice(0,1000));window.open(${JSON.stringify(
    origin,
  )}+'/capture?url='+u+'&title='+t+'&text='+s,'logbook-capture','width=520,height=640')})()`;

  useEffect(() => {
    ref.current?.setAttribute("href", code);
  }, [code]);

  return (
    <div className="flex flex-col gap-2">
      <a
        ref={ref}
        onClick={(e) => e.preventDefault()}
        className={`${cls.btnPrimary} cursor-grab self-start`}
        title="Drag me to your bookmarks bar"
      >
        📓 Save to Logbook
      </a>
      <details className="text-xs text-muted">
        <summary className="cursor-pointer">Can&apos;t drag? Copy the code instead</summary>
        <textarea readOnly value={code} rows={4} className={`${cls.textarea} mt-2 font-mono text-[11px]`} onFocus={(e) => e.currentTarget.select()} />
        <p className="mt-1">Create a new bookmark, paste this as its URL.</p>
      </details>
    </div>
  );
}
