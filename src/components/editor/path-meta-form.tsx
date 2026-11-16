"use client";

import { useActionState } from "react";
import { updatePathMeta } from "@/app/(app)/paths/actions";
import { cls, FormMessage, SubmitButton } from "@/components/ui";

export function PathMetaForm({ id, emoji, description }: { id: string; emoji: string | null; description: string | null }) {
  const [state, action] = useActionState(updatePathMeta, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input name="emoji" aria-label="Emoji" maxLength={16} defaultValue={emoji ?? ""} placeholder="🧭" className={cls.inputEmoji} />
      <input name="description" aria-label="One-line goal" maxLength={500} defaultValue={description ?? ""} placeholder="One-line goal" className={`${cls.input} min-w-48 flex-1`} />
      <SubmitButton className={cls.btn} pendingLabel="…">
        Save
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
