"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { ExternalLink, Pencil, Star, Trash2 } from "lucide-react";
import { createList, deleteEntry, saveEntry, setEntryStatus, updateList } from "@/app/(app)/lists/actions";
import { cls, FormMessage, SubmitButton } from "@/components/ui";

export type ListKind = "watchlist" | "people" | "generic";
export type EntryStatus = "todo" | "doing" | "done";

export const KIND_COPY: Record<ListKind, { status: Record<EntryStatus, string>; subtitle: string; title: string; emoji: string }> = {
  watchlist: { status: { todo: "To watch", doing: "Watching", done: "Watched" }, subtitle: "Movie, series, anime, book…", title: "Title", emoji: "🎬" },
  people: { status: { todo: "Reach out", doing: "In touch", done: "Connected" }, subtitle: "Who they are — role, where you met", title: "Name", emoji: "🧑‍🤝‍🧑" },
  generic: { status: { todo: "To do", doing: "Doing", done: "Done" }, subtitle: "Detail", title: "Title", emoji: "📋" },
};

export interface Entry {
  id: string;
  title: string;
  subtitle: string | null;
  url: string | null;
  notes: string | null;
  status: EntryStatus;
  rating: number | null;
}

export function NewListForm() {
  const [state, action] = useActionState(createList, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div>
        <label className={cls.label} htmlFor="nl-emoji">
          Emoji
        </label>
        <input id="nl-emoji" name="emoji" maxLength={16} placeholder="📋" className={`${cls.input} w-14 text-center`} />
      </div>
      <div className="min-w-40 flex-1">
        <label className={cls.label} htmlFor="nl-name">
          List name
        </label>
        <input id="nl-name" name="name" required maxLength={80} placeholder="Books to read, Startup ideas…" className={cls.input} />
      </div>
      <div>
        <label className={cls.label} htmlFor="nl-kind">
          Type
        </label>
        <select id="nl-kind" name="kind" className={cls.select}>
          <option value="generic">General</option>
          <option value="watchlist">Watchlist</option>
          <option value="people">People</option>
        </select>
      </div>
      <SubmitButton pendingLabel="Creating…">Create list</SubmitButton>
      <div className="basis-full">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function EditListForm({ list }: { list: { id: string; name: string; emoji: string | null; kind: ListKind } }) {
  const [state, action] = useActionState(updateList, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={list.id} />
      <input name="emoji" aria-label="Emoji" maxLength={16} defaultValue={list.emoji ?? ""} className={`${cls.input} w-14 text-center`} />
      <input name="name" aria-label="List name" required maxLength={80} defaultValue={list.name} className={`${cls.input} min-w-40 flex-1`} />
      <select name="kind" aria-label="Type" defaultValue={list.kind} className={cls.select}>
        <option value="generic">General</option>
        <option value="watchlist">Watchlist</option>
        <option value="people">People</option>
      </select>
      <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

function RatingInput({ name, defaultValue }: { name: string; defaultValue: number | null }) {
  const [value, setValue] = useState(defaultValue ?? 0);
  return (
    <div className="flex items-center gap-0.5" role="radiogroup" aria-label="Rating">
      <input type="hidden" name={name} value={value || ""} />
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setValue(value === n ? 0 : n)} className="p-0.5">
          <Star className={`size-4 ${n <= value ? "fill-yellow-400 text-yellow-400" : "text-muted"}`} aria-hidden />
        </button>
      ))}
    </div>
  );
}

export function EntryForm({ listId, kind, entry, onDone }: { listId: string; kind: ListKind; entry?: Entry; onDone?: () => void }) {
  const [state, action] = useActionState(saveEntry, null);
  const formRef = useRef<HTMLFormElement>(null);
  const copy = KIND_COPY[kind];
  const key = entry?.id ?? "new";

  useEffect(() => {
    if (!state?.ok) return;
    if (entry) onDone?.();
    else {
      formRef.current?.reset();
      formRef.current?.querySelector<HTMLInputElement>("input[name=title]")?.focus();
    }
  }, [state, entry, onDone]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2">
      <input type="hidden" name="listId" value={listId} />
      {entry ? <input type="hidden" name="id" value={entry.id} /> : null}
      <div className="grid gap-2 sm:grid-cols-[2fr_2fr_1fr]">
        <input name="title" aria-label={copy.title} required maxLength={300} defaultValue={entry?.title} placeholder={copy.title} className={cls.input} />
        <input name="subtitle" aria-label="Detail" maxLength={200} defaultValue={entry?.subtitle ?? ""} placeholder={copy.subtitle} className={cls.input} />
        <select name="status" aria-label="Status" defaultValue={entry?.status ?? "todo"} className={cls.select}>
          {(Object.keys(copy.status) as EntryStatus[]).map((s) => (
            <option key={s} value={s}>
              {copy.status[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2 sm:grid-cols-[2fr_3fr]">
        <input name="url" aria-label="Link" maxLength={4096} defaultValue={entry?.url ?? ""} placeholder={kind === "people" ? "LinkedIn / X / site" : "Link (optional)"} className={cls.input} />
        <input name="notes" aria-label="Notes" maxLength={5_000} defaultValue={entry?.notes ?? ""} placeholder="Notes" className={cls.input} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <RatingInput key={`${key}-${state?.ok ? "r" : ""}`} name="rating" defaultValue={entry?.rating ?? null} />
        <SubmitButton pendingLabel="Saving…">{entry ? "Save" : "Add"}</SubmitButton>
        {entry ? (
          <button type="button" className={cls.btn} onClick={onDone}>
            Cancel
          </button>
        ) : null}
        <FormMessage state={state?.ok ? null : state} />
      </div>
    </form>
  );
}

const NEXT_STATUS: Record<EntryStatus, EntryStatus> = { todo: "doing", doing: "done", done: "todo" };
const STATUS_STYLE: Record<EntryStatus, string> = { todo: "border-line text-muted", doing: "border-accent/60 text-accent", done: "border-success/60 text-success" };

export function EntryRow({ entry, listId, kind }: { entry: Entry; listId: string; kind: ListKind }) {
  const [editing, setEditing] = useState(false);
  const [, start] = useTransition();
  const copy = KIND_COPY[kind];

  if (editing) {
    return (
      <li id={`entry-${entry.id}`} className="rounded-xl border border-line bg-panel-2 p-3">
        <EntryForm listId={listId} kind={kind} entry={entry} onDone={() => setEditing(false)} />
      </li>
    );
  }

  return (
    <li id={`entry-${entry.id}`} className="group flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-panel-2/50">
      <button
        type="button"
        onClick={() => start(() => setEntryStatus(entry.id, NEXT_STATUS[entry.status]))}
        className={`mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLE[entry.status]}`}
        title="Click to change status"
      >
        {copy.status[entry.status]}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`break-words text-sm font-medium ${entry.status === "done" && kind !== "people" ? "text-muted" : ""}`}>
          {entry.title}
          {entry.rating ? <span className="ml-2 text-xs text-yellow-400">{"★".repeat(entry.rating)}</span> : null}
        </p>
        {entry.subtitle ? <p className="text-xs text-muted">{entry.subtitle}</p> : null}
        {entry.notes ? <p className="mt-0.5 text-xs text-fg/80">{entry.notes}</p> : null}
      </div>
      <div className="flex items-center gap-1 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
        {entry.url ? (
          <a href={entry.url} target="_blank" rel="noopener noreferrer" className={cls.btnGhost} aria-label="Open link">
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        ) : null}
        <button type="button" className={cls.btnGhost} aria-label={`Edit ${entry.title}`} onClick={() => setEditing(true)}>
          <Pencil className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          className={cls.btnGhost}
          aria-label={`Delete ${entry.title}`}
          onClick={() => window.confirm(`Delete “${entry.title}”?`) && start(() => deleteEntry(entry.id))}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      </div>
    </li>
  );
}
