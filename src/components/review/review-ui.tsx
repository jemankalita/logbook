"use client";

import { useActionState, useOptimistic, useRef, useTransition } from "react";
import { ArrowRight, CheckCircle2, Plus, RotateCcw } from "lucide-react";
import { carryAllToNextWeek, carryTaskToNextWeek, saveReflection } from "@/app/(app)/review/actions";
import { createTask, toggleTask } from "@/app/(app)/tasks/actions";
import type { ActionResult } from "@/lib/actions";
import { formatDay, type Day } from "@/lib/dates";
import type { Reflection } from "@/lib/review";
import type { Task } from "@/lib/queries/tasks";
import { cls } from "../cls";
import { FormMessage, SubmitButton } from "../ui";

const PROMPTS = [
  { name: "wins", label: "What went well?", placeholder: "Wins, progress, things you're proud of…" },
  { name: "blockers", label: "What got in the way?", placeholder: "Distractions, blockers, what you'd do differently…" },
  { name: "focus", label: "Focus for next week", placeholder: "The 1–3 things that matter most next week…" },
] as const;

export function ReflectionForm({ start, reflection }: { start: Day; reflection: Reflection }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(saveReflection.bind(null, start), null);
  const reviewed = Boolean(reflection.reviewedAt);
  return (
    <form action={action} className="flex flex-col gap-4">
      {PROMPTS.map((p) => (
        <div key={p.name}>
          <label htmlFor={`r-${p.name}`} className={cls.label}>
            {p.label}
          </label>
          <textarea id={`r-${p.name}`} name={p.name} rows={3} maxLength={5000} defaultValue={reflection[p.name]} placeholder={p.placeholder} className={`${cls.textarea} resize-y`} />
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        {reviewed ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-sm text-success">
              <CheckCircle2 className="size-4" aria-hidden /> Reviewed
            </span>
            <SubmitButton name="intent" value="save" pendingLabel="Saving…" className={cls.btnPrimary}>
              Save changes
            </SubmitButton>
            <SubmitButton name="intent" value="reopen" pendingLabel="Reopening…" className={cls.btnGhost}>
              <RotateCcw className="size-3.5" aria-hidden /> Reopen
            </SubmitButton>
          </>
        ) : (
          <>
            <SubmitButton name="intent" value="complete" pendingLabel="Saving…" className={cls.btnPrimary}>
              <CheckCircle2 className="size-4" aria-hidden /> Mark week reviewed
            </SubmitButton>
            <SubmitButton name="intent" value="save" pendingLabel="Saving…" className={cls.btn}>
              Save draft
            </SubmitButton>
          </>
        )}
        <FormMessage state={state} />
      </div>
    </form>
  );
}

/** A carry-over task: tick it off, or push it to next Monday. */
export function CarryRow({ task, start, today }: { task: Task; start: Day; today: Day }) {
  const [gone, hide] = useOptimistic(false, () => true);
  const [pending, run] = useTransition();
  if (gone) return null;
  const late = task.dueDate !== null && task.dueDate < today;
  return (
    <li className="group flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors duration-150 hover:bg-panel-2/60">
      <input
        type="checkbox"
        aria-label={`Mark “${task.title}” done`}
        disabled={pending}
        onChange={() =>
          run(async () => {
            hide(null);
            await toggleTask(task.id);
          })
        }
        className="size-4 shrink-0"
      />
      <span className="min-w-0 flex-1 truncate">{task.title}</span>
      {task.dueDate ? <span className={`tabular shrink-0 text-xs ${late ? "text-danger" : "text-faint"}`}>{formatDay(task.dueDate, { month: "short", day: "numeric" })}</span> : null}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          run(async () => {
            hide(null);
            await carryTaskToNextWeek(start, task.id);
          })
        }
        className={`${cls.btnGhost} h-7 shrink-0 text-[12px]`}
        aria-label={`Move “${task.title}” to next week`}
      >
        Next week <ArrowRight className="size-3.5" aria-hidden />
      </button>
    </li>
  );
}

export function CarryAllButton({ start, count }: { start: Day; count: number }) {
  const [pending, run] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => run(() => carryAllToNextWeek(start))} className={`${cls.btn} h-7 px-2.5 text-[12px]`}>
      {pending ? "Moving…" : `Move all ${count} to next week`}
    </button>
  );
}

/** Quick "plan next week": a one-line task due next Monday, in Overall To-Do. */
export function PlanTaskForm({ dueDate }: { dueDate: Day }) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState<ActionResult | null, FormData>(async (prev, fd) => {
    const result = await createTask(prev, fd);
    if (result.ok) ref.current?.reset();
    return result;
  }, null);
  return (
    <form ref={ref} action={action} className="flex flex-col gap-2">
      <input type="hidden" name="horizon" value="upcoming" />
      <input type="hidden" name="dueDate" value={dueDate} />
      <div className="flex gap-2">
        <label htmlFor="plan-title" className="sr-only">
          New task for next week
        </label>
        <input id="plan-title" name="title" required maxLength={300} placeholder="Add a task for next week…" className={`${cls.input} min-w-0 flex-1`} />
        <SubmitButton pendingLabel="Adding…" className={cls.btn} aria-label="Add task">
          <Plus className="size-4" aria-hidden />
        </SubmitButton>
      </div>
      {state && !state.ok ? <FormMessage state={state} /> : null}
    </form>
  );
}
