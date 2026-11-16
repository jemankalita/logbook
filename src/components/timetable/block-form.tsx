"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
          <input id={`b-title-${key}`} autoFocus={Boolean(draft.id)} name="title" required maxLength={200} defaultValue={draft.title} placeholder="DSA lecture, Gym, GRE verbal…" className={cls.input} />
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

export function EditBlockButton({ draft, areas, className }: { draft: BlockDraft; areas: string[]; className: string }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const close = useCallback(() => dialogRef.current?.close(), []);

  // A modal <dialog> gives a focus trap, an inert page behind it, Esc to close and focus return to this button.
  useEffect(() => {
    if (open) dialogRef.current?.showModal();
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`Edit ${draft.title}`} title="Edit" className={className}>
        <Pencil className="size-3.5" aria-hidden />
      </button>
      {/* Portalled to <body> so the form is never nested inside the card's own forms. */}
      {open
        ? createPortal(
            <dialog
              ref={dialogRef}
              aria-labelledby={`edit-block-${draft.id}`}
              onClose={() => setOpen(false)}
              onMouseDown={(e) => e.target === e.currentTarget && close()}
              className="m-auto w-[calc(100%-2rem)] max-w-2xl animate-pop-in rounded-xl border border-line bg-panel p-0 text-fg shadow-pop backdrop:animate-fade-in backdrop:bg-black/60 backdrop:backdrop-blur-[2px]"
            >
              <div className="p-5">
                <h2 id={`edit-block-${draft.id}`} className="mb-4 font-display text-2xl leading-none">
                  Edit block
                </h2>
                <BlockForm draft={draft} areas={areas} onDone={close} />
              </div>
            </dialog>,
            document.body,
          )
        : null}
    </>
  );
}
