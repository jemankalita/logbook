"use client";

import { useRef, useState } from "react";
import type { ActionResult } from "@/lib/actions";

/** Big borderless title that saves when you leave the field or press Enter. */
export function TitleInput({ initial, save, label, placeholder = "Untitled" }: { initial: string; save: (title: string) => Promise<ActionResult>; label: string; placeholder?: string }) {
  const [error, setError] = useState<string | null>(null);
  const last = useRef(initial);

  async function commit(value: string) {
    const next = value.trim() || placeholder;
    if (next === last.current) return;
    const res = await save(next);
    if (res.ok) {
      last.current = next;
      setError(null);
    } else setError(res.error);
  }

  return (
    <div>
      <label className="sr-only" htmlFor="doc-title">
        {label}
      </label>
      <input
        id="doc-title"
        defaultValue={initial === "Untitled" ? "" : initial}
        placeholder={placeholder}
        maxLength={300}
        onBlur={(e) => void commit(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.currentTarget.closest("div")?.parentElement?.querySelector(".ProseMirror") as HTMLElement | null)?.focus();
            void commit(e.currentTarget.value);
          }
        }}
        className="w-full bg-transparent text-3xl font-bold outline-none placeholder:text-muted/50"
      />
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
