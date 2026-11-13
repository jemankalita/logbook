"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { saveBlock } from "@/app/(app)/timetable/actions";
import { cls, FormMessage, SubmitButton } from "@/components/ui";

export interface BlockDraft {
  id?: string;
  title?: string;
  area?: string | null;
  notes?: string | null;
  day: string;
  start: string;
  end: string;
}

export function BlockForm({ draft, areas, onDone }: { draft: BlockDraft; areas: string[]; onDone?: () => void }) {
  const [state, action] = useActionState(saveBlock, null);
  const formRef = useRef<HTMLFormElement>(null);
  const key = draft.id ?? "new";

  useEffect(() => {
    if (!state?.ok) return;
    if (draft.id) onDone?.();
    else formRef.current?.querySelector<HTMLInputElement>("input[name=title]")?.select();
  }, [state, draft.id, onDone]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2">
      {draft.id ? <input type="hidden" name="id" value={draft.id} /> : null}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
        <div className="col-span-2">
          <label className={cls.label} htmlFor={`b-title-${key}`}>
            What
          </label>
          <input id={`b-title-${key}`} name="title" required maxLength={200} defaultValue={draft.title} placeholder="DSA lecture, Gym, GRE verbal…" className={cls.input} />
        </div>
        <div>
          <label className={cls.label} htmlFor={`b-day-${key}`}>
            Day
          </label>
          <input id={`b-day-${key}`} name="day" type="date" required defaultValue={draft.day} className={cls.input} />
        </div>
        <div>
          <label className={cls.label} htmlFor={`b-start-${key}`}>
            From
          </label>
          <input id={`b-start-${key}`} name="start" type="time" required defaultValue={draft.start} className={cls.input} />
        </div>
        <div>
          <label className={cls.label} htmlFor={`b-end-${key}`}>
            To
          </label>
          <input id={`b-end-${key}`} name="end" type="time" required defaultValue={draft.end} className={cls.input} />
        </div>
        <div>
          <label className={cls.label} htmlFor={`b-area-${key}`}>
            Area
          </label>
          <input id={`b-area-${key}`} name="area" list={`b-areas-${key}`} maxLength={60} defaultValue={draft.area ?? ""} placeholder="college" className={cls.input} />
          <datalist id={`b-areas-${key}`}>
            {areas.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </div>
      </div>
      <label className="sr-only" htmlFor={`b-notes-${key}`}>
        Notes
      </label>
      <input id={`b-notes-${key}`} name="notes" maxLength={2_000} defaultValue={draft.notes ?? ""} placeholder="Notes (room, link…)" className={cls.input} />
      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton pendingLabel="Saving…">{draft.id ? "Save block" : "Add block"}</SubmitButton>
        {draft.id ? (
          <button type="button" onClick={onDone} className={cls.btn}>
            Cancel
          </button>
        ) : null}
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function EditBlockButton({ draft, areas }: { draft: BlockDraft; areas: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`Edit ${draft.title}`} className="text-muted hover:text-fg">
        <Pencil className="size-3" aria-hidden />
      </button>
      {open ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Edit block" className="w-full max-w-2xl rounded-xl border border-line bg-panel shadow-card p-4">
            <BlockForm draft={draft} areas={areas} onDone={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </>
  );
}
