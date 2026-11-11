"use client";

import { Check, Undo2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { checkIn, undoCheckIn } from "@/app/(app)/actions";

function CheckInButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 w-full rounded-xl bg-success font-semibold text-black transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
    >
      {pending ? "Checking in…" : "Mark today present"}
    </button>
  );
}

function UndoButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-fg disabled:opacity-60"
    >
      <Undo2 className="size-3" aria-hidden /> Undo
    </button>
  );
}

export function CheckInCard({ checkedInLabel }: { checkedInLabel: string | null }) {
  return (
    <section className="flex flex-col justify-between gap-4 rounded-2xl border border-line bg-panel p-5">
      <div>
        <h2 className="text-sm font-medium text-muted">Daily attendance</h2>
        {checkedInLabel ? (
          <p className="mt-2 flex items-center gap-2 text-lg font-semibold">
            <span className="grid size-7 place-items-center rounded-full bg-success text-black">
              <Check className="size-4" aria-hidden />
            </span>
            Present today
          </p>
        ) : (
          <p className="mt-2 text-lg font-semibold">You haven&apos;t checked in yet</p>
        )}
      </div>

      {checkedInLabel ? (
        <div className="flex items-center justify-between text-sm text-muted">
          <span>Checked in at {checkedInLabel}</span>
          <form action={undoCheckIn}>
            <UndoButton />
          </form>
        </div>
      ) : (
        <form action={checkIn}>
          <CheckInButton />
        </form>
      )}
    </section>
  );
}
