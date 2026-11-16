"use client";

import { Check, Flame, Undo2 } from "lucide-react";
import { motion } from "motion/react";
import { useFormStatus } from "react-dom";
import { checkIn, undoCheckIn } from "@/app/(app)/actions";
import { springs } from "@/lib/motion-tokens";
import { cls } from "./cls";

function CheckInButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="group relative flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-success text-sm font-semibold text-bg shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_1px_2px_rgb(0_0_0/0.4)] transition-[filter,transform] duration-150 ease-out hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
    >
      <Check className="size-4 transition-transform duration-150 group-hover:scale-110" strokeWidth={2.5} aria-hidden />
      {pending ? "Checking in…" : "Mark today present"}
    </button>
  );
}

function UndoButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-xs text-faint transition-colors duration-150 hover:bg-panel-2 hover:text-fg disabled:opacity-60">
      <Undo2 className="size-3" aria-hidden /> Undo
    </button>
  );
}

/** The one thing to do every day: say you showed up. */
export function CheckInCard({ checkedInLabel, streak }: { checkedInLabel: string | null; streak: number }) {
  const present = Boolean(checkedInLabel);
  return (
    <section className={`${cls.card} relative flex flex-col justify-between gap-6 overflow-hidden p-5`}>
      {/* The card warms up once you've checked in. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,rgb(62_207_142/0.10),transparent_60%)] transition-opacity duration-500 ${present ? "opacity-100" : "opacity-0"}`}
      />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <h2 className={cls.h2}>Daily attendance</h2>
          {streak > 0 ? (
            <span className="tabular inline-flex items-center gap-1 text-xs text-warn" title="Current streak">
              <Flame className="size-3.5" aria-hidden />
              {streak} day{streak === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
        {present ? (
          <div className="mt-4 flex items-center gap-3">
            <motion.span
              key="present"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={springs.gentle}
              className="grid size-9 shrink-0 place-items-center rounded-full bg-success text-bg shadow-[0_0_0_4px_rgb(62_207_142/0.15)]"
            >
              <Check className="size-5" strokeWidth={2.5} aria-hidden />
            </motion.span>
            <p className="font-display text-[1.6rem] leading-tight">Present today</p>
          </div>
        ) : (
          <p className="mt-4 font-display text-[1.6rem] leading-tight">You haven&apos;t checked in yet</p>
        )}
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {present
            ? "That's today on the board. See you tomorrow."
            : streak > 0
              ? `Keep your ${streak}-day streak alive — one tap is all it takes.`
              : "One tap a day. It's how your year fills in below."}
        </p>
      </div>

      <div className="relative">
        {present ? (
          <div className="flex items-center justify-between text-sm text-muted">
            <span>
              Checked in at <span className="tabular text-fg">{checkedInLabel}</span>
            </span>
            <form action={undoCheckIn}>
              <UndoButton />
            </form>
          </div>
        ) : (
          <form action={checkIn}>
            <CheckInButton />
          </form>
        )}
      </div>
    </section>
  );
}
