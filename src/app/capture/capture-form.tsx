"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { saveLink } from "@/app/(app)/library/actions";
import { quickNote } from "@/app/(app)/search-actions";
import { FolderSelect, type FolderOption } from "@/components/library/forms";
import { cls, FormMessage, SubmitButton } from "@/components/ui";
import type { ActionResult } from "@/lib/actions";

export function CaptureForm({ url, title, text, folders }: { url: string; title: string; text: string; folders: FolderOption[] }) {
  const [state, action] = useActionState(saveLink, null);
  const [noteState, setNoteState] = useState<ActionResult | null>(null);
  const [notePending, startNote] = useTransition();
  const done = state?.ok || noteState?.ok;

  if (done) {
    const result = (state?.ok ? state : noteState) as ActionResult & { ok: true };
    const href = state?.ok ? `/library/${result.id}` : `/notes/${result.id}`;
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-success text-2xl text-bg" aria-hidden>
          ✓
        </span>
        <p role="status" className="font-medium">
          {result.message}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => window.close()} className={cls.btnPrimary}>
            Close
          </button>
          <Link href={href} className={cls.btn}>
            Open in Logbook
          </Link>
        </div>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">No link found in what you shared. Save it as a note instead?</p>
        <textarea id="cap-text" defaultValue={text || title} rows={6} className={cls.textarea} aria-label="Note text" />
        <button
          type="button"
          disabled={notePending}
          className={cls.btnPrimary}
          onClick={() => {
            const value = (document.getElementById("cap-text") as HTMLTextAreaElement | null)?.value ?? "";
            startNote(async () => setNoteState(await quickNote(value)));
          }}
        >
          {notePending ? "Saving…" : "Save as note"}
        </button>
        <FormMessage state={noteState} />
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <div>
        <label className={cls.label} htmlFor="cap-url">
          Link
        </label>
        <input id="cap-url" name="url" defaultValue={url} required className={cls.input} />
      </div>
      <div>
        <label className={cls.label} htmlFor="cap-title">
          Title <span className="font-normal">(leave empty to use the page&apos;s own)</span>
        </label>
        <input id="cap-title" name="title" defaultValue={title} maxLength={500} className={cls.input} />
      </div>
      <div>
        <label className={cls.label} htmlFor="cap-folder">
          Folder
        </label>
        <FolderSelect id="cap-folder" options={folders} />
      </div>
      <div>
        <label className={cls.label} htmlFor="cap-note">
          Note
        </label>
        <textarea id="cap-note" name="note" defaultValue={text} rows={3} maxLength={5_000} placeholder="Why you're saving it" className={cls.textarea} />
      </div>
      <SubmitButton pendingLabel="Saving…" autoFocus>
        Save to Library
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
