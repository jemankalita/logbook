"use client";

import { useActionState, useEffect, useRef } from "react";
import { createFolder, saveLink, updateFolder } from "@/app/(app)/library/actions";
import { cls, FormMessage, SubmitButton } from "@/components/ui";

export interface FolderOption {
  id: string;
  label: string;
}

export function FolderSelect({
  options,
  name = "folderId",
  defaultValue,
  emptyLabel = "Unsorted",
  id,
}: {
  options: FolderOption[];
  name?: string;
  defaultValue?: string | null;
  emptyLabel?: string;
  id?: string;
}) {
  return (
    <select id={id} name={name} defaultValue={defaultValue ?? ""} className={`${cls.select} w-full`}>
      <option value="">{emptyLabel}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function AddLinkForm({ folders, defaultFolderId }: { folders: FolderOption[]; defaultFolderId?: string | null }) {
  const [state, action] = useActionState(saveLink, null);
  const urlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.ok && urlRef.current) {
      urlRef.current.value = "";
      urlRef.current.focus();
    }
  }, [state]);

  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="add-url">
          Link
        </label>
        <input
          ref={urlRef}
          id="add-url"
          name="url"
          type="text"
          inputMode="url"
          required
          placeholder="Paste a link — article, video, X post, course…"
          className={`${cls.input} flex-1`}
          autoComplete="off"
        />
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="add-folder">
            Folder
          </label>
          <div className="min-w-0 flex-1 sm:w-44">
            <FolderSelect id="add-folder" options={folders} defaultValue={defaultFolderId} />
          </div>
          <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
        </div>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function FolderForm({
  folders,
  folder,
}: {
  folders: FolderOption[];
  folder?: { id: string; name: string; emoji: string | null; parentId: string | null };
}) {
  const [state, action] = useActionState(folder ? updateFolder : createFolder, null);
  const formRef = useRef<HTMLFormElement>(null);
  const key = folder?.id ?? "new";

  useEffect(() => {
    if (state?.ok && !folder) formRef.current?.reset();
  }, [state, folder]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2">
      {folder ? <input type="hidden" name="id" value={folder.id} /> : null}
      <div className="flex gap-2">
        <label className="sr-only" htmlFor={`f-emoji-${key}`}>
          Emoji
        </label>
        <input id={`f-emoji-${key}`} name="emoji" defaultValue={folder?.emoji ?? ""} placeholder="📁" maxLength={16} className={cls.inputEmoji} />
        <label className="sr-only" htmlFor={`f-name-${key}`}>
          Folder name
        </label>
        <input id={`f-name-${key}`} name="name" required defaultValue={folder?.name ?? ""} placeholder="Folder name" maxLength={120} className={cls.input} />
      </div>
      <label className={cls.label} htmlFor={`f-parent-${key}`}>
        Inside
      </label>
      <FolderSelect
        id={`f-parent-${key}`}
        name="parentId"
        options={folders.filter((f) => f.id !== folder?.id)}
        defaultValue={folder?.parentId}
        emptyLabel="Top level"
      />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Saving…">{folder ? "Save folder" : "Create folder"}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
