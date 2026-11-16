"use client";

import { useActionState } from "react";
import { FolderSelect, type FolderOption } from "@/components/library/forms";
import { STATUS_LABELS, TYPE_LABELS } from "@/components/library/labels";
import { cls, FormMessage, SubmitButton } from "@/components/ui";
import type { Item } from "@/lib/queries/library";
import { updateItem } from "../actions";

export function ItemForm({ item, folders }: { item: Item & { tags: string[] }; folders: FolderOption[] }) {
  const [state, action] = useActionState(updateItem, null);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={item.id} />
      <div>
        <label className={cls.label} htmlFor="it-title">
          Title
        </label>
        <input id="it-title" name="title" required maxLength={500} defaultValue={item.title} className={cls.input} />
      </div>
      <div>
        <label className={cls.label} htmlFor="it-summary">
          Your note
        </label>
        <textarea id="it-summary" name="summary" rows={4} maxLength={10_000} defaultValue={item.summary ?? ""} placeholder="Why you saved it, key takeaways…" className={cls.textarea} />
      </div>
      <div>
        <label className={cls.label} htmlFor="it-folder">
          Folder
        </label>
        <FolderSelect id="it-folder" options={folders} defaultValue={item.folderId} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={cls.label} htmlFor="it-status">
            Status
          </label>
          <select id="it-status" name="status" defaultValue={item.status} className={`${cls.select} w-full`}>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={cls.label} htmlFor="it-type">
            Type
          </label>
          <select id="it-type" name="type" defaultValue={item.type} className={`${cls.select} w-full`}>
            {Object.entries(TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className={cls.label} htmlFor="it-tags">
          Tags <span className="font-normal">(comma separated)</span>
        </label>
        <input id="it-tags" name="tags" defaultValue={item.tags.join(", ")} placeholder="ml, interview-prep" className={cls.input} />
      </div>
      <div>
        <label className={cls.label} htmlFor="it-deadline">
          Do by <span className="font-normal">(optional)</span>
        </label>
        <input id="it-deadline" name="deadline" type="date" defaultValue={item.deadline ?? ""} className={cls.input} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
