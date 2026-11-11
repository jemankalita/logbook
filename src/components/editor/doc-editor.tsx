"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActionResult } from "@/lib/actions";
import type { DocNode } from "@/lib/rich-text";
import { RichEditor } from "./rich-editor";

const SAVE_DELAY_MS = 800;

type SaveState = "saved" | "dirty" | "saving" | "error";

const LABELS: Record<SaveState, string> = { saved: "Saved", dirty: "Unsaved changes", saving: "Saving…", error: "Couldn't save — retrying when you type" };

/** Editor that autosaves through a server action (bound to the record it edits). */
export function DocEditor({
  initial,
  save,
  label,
  placeholder,
}: {
  initial: DocNode | null;
  save: (json: string) => Promise<ActionResult>;
  label: string;
  placeholder?: string;
}) {
  const [state, setState] = useState<SaveState>("saved");
  const latest = useRef<DocNode | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);

  const flush = useCallback(async () => {
    if (!latest.current || inFlight.current) return;
    const doc = latest.current;
    latest.current = null;
    inFlight.current = true;
    setState("saving");
    try {
      const res = await save(JSON.stringify(doc));
      inFlight.current = false;
      if (!res.ok) {
        latest.current ??= doc;
        setState("error");
        return;
      }
      if (latest.current) void flush();
      else setState("saved");
    } catch {
      inFlight.current = false;
      latest.current ??= doc;
      setState("error");
    }
  }, [save]);

  const onChange = useCallback(
    (doc: DocNode) => {
      latest.current = doc;
      setState("dirty");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush],
  );

  // Warn before leaving with unsaved text; save on tab hide.
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (latest.current || inFlight.current) e.preventDefault();
    };
    const hidden = () => document.visibilityState === "hidden" && void flush();
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("visibilitychange", hidden);
      if (timer.current) clearTimeout(timer.current);
      void flush();
    };
  }, [flush]);

  return (
    <div className="relative">
      <p aria-live="polite" className={`absolute -top-7 right-0 text-xs ${state === "error" ? "text-danger" : "text-muted"}`}>
        {LABELS[state]}
      </p>
      <RichEditor initial={initial} onChange={onChange} label={label} placeholder={placeholder} />
    </div>
  );
}
