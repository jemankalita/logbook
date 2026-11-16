"use client";

import { useActionState, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { Check, Clock, Flame, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { createTask, deleteTask, snoozeTask, toggleTask, updateTask } from "@/app/(app)/tasks/actions";
import { cls, FormMessage, SubmitButton } from "@/components/ui";
import { formatDay, type Day } from "@/lib/dates";
import type { Habit, Horizon, Task } from "@/lib/queries/tasks";
import { describeRecurrence } from "@/lib/tasks/recurrence";

export interface TaskFormOptions {
  paths: { id: string; name: string }[];
  areas: string[];
}

const PRIORITY_DOT: Record<string, string> = { high: "bg-danger", medium: "bg-warn", low: "bg-accent" };
const STATUS_LABEL: Record<Task["status"], string> = { not_started: "Not started", in_progress: "In progress", done: "Done" };

function Checkbox({ checked, label, onToggle }: { checked: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={`relative grid size-5 shrink-0 place-items-center rounded-md border transition-colors duration-150 after:absolute after:-inset-2 ${checked ? "border-success bg-success text-bg" : "border-muted/60 hover:border-fg"}`}
    >
      {checked ? <Check className="size-3.5" aria-hidden /> : null}
    </button>
  );
}

function useToggle(id: string, initial: boolean) {
  const [optimistic, setOptimistic] = useOptimistic(initial);
  const [, start] = useTransition();
  return [
    optimistic,
    () =>
      start(async () => {
        setOptimistic(!optimistic);
        await toggleTask(id);
      }),
  ] as const;
}

function dueLabel(due: Day | null, today: Day): { text: string; overdue: boolean } | null {
  if (!due) return null;
  if (due === today) return { text: "Today", overdue: false };
  if (due < today) return { text: `Overdue · ${formatDay(due, { month: "short", day: "numeric" })}`, overdue: true };
  return { text: formatDay(due, { weekday: "short", month: "short", day: "numeric" }), overdue: false };
}

export function TaskRow({ task, today, options, pathName }: { task: Task; today: Day; options: TaskFormOptions; pathName?: string | null }) {
  const [done, toggle] = useToggle(task.id, task.status === "done");
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState(false);
  const [, start] = useTransition();
  const due = task.status === "done" ? null : dueLabel(task.dueDate, today);

  if (editing) {
    return (
      <li id={`task-${task.id}`} className="rounded-xl border border-line bg-panel-2 p-3">
        <TaskForm task={task} horizon={task.horizon} options={options} onDone={() => setEditing(false)} />
      </li>
    );
  }

  return (
    <li id={`task-${task.id}`} className="group flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-panel-2/50">
      <div className="pt-0.5">
        <Checkbox checked={done} label={`Mark “${task.title}” ${done ? "not done" : "done"}`} onToggle={toggle} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`break-words text-sm ${done ? "text-muted line-through" : ""}`}>{task.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          {task.priority ? (
            <span className="inline-flex items-center gap-1">
              <span aria-hidden className={`size-1.5 rounded-full ${PRIORITY_DOT[task.priority]}`} />
              {task.priority}
            </span>
          ) : null}
          {due ? <span className={due.overdue ? "text-danger" : ""}>{due.text}</span> : null}
          {task.status === "in_progress" ? <span className="text-accent">In progress</span> : null}
          {task.area ? <span>#{task.area}</span> : null}
          {pathName ? <span>↳ {pathName}</span> : null}
          {task.description ? <span className="line-clamp-1 max-w-xs">{task.description}</span> : null}
        </div>
      </div>
      <div className="relative">
        <button type="button" aria-label="Task actions" aria-expanded={menu} onClick={() => setMenu((m) => !m)} className={`${cls.btnGhost} md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100`}>
          <MoreHorizontal className="size-4" aria-hidden />
        </button>
        {menu ? (
          <div className="absolute right-0 z-20 mt-1 w-40 rounded-xl border border-line bg-panel p-1 shadow-xl" onMouseLeave={() => setMenu(false)}>
            <button type="button" className={`${cls.btnGhost} w-full justify-start`} onClick={() => (setMenu(false), setEditing(true))}>
              <Pencil className="size-3.5" aria-hidden /> Edit
            </button>
            {!done && task.dueDate && task.dueDate <= today ? (
              <button type="button" className={`${cls.btnGhost} w-full justify-start`} onClick={() => (setMenu(false), start(() => snoozeTask(task.id)))}>
                <Clock className="size-3.5" aria-hidden /> Tomorrow
              </button>
            ) : null}
            <button
              type="button"
              className={`${cls.btnGhost} w-full justify-start text-danger`}
              onClick={() => {
                setMenu(false);
                if (window.confirm(`Delete “${task.title}”?`)) start(() => deleteTask(task.id));
              }}
            >
              <Trash2 className="size-3.5" aria-hidden /> Delete
            </button>
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function HabitRow({ habit, options }: { habit: Habit; options: TaskFormOptions }) {
  const [done, toggle] = useToggle(habit.id, habit.doneToday);
  const [editing, setEditing] = useState(false);
  const [, start] = useTransition();
  const streak = habit.streak + (done && !habit.doneToday ? 1 : 0) - (!done && habit.doneToday ? 1 : 0);

  if (editing) {
    return (
      <li className="rounded-xl border border-line bg-panel-2 p-3">
        <TaskForm task={habit} horizon="daily" options={options} onDone={() => setEditing(false)} habit />
      </li>
    );
  }

  return (
    <li className="group flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-panel-2/50">
      <Checkbox checked={done} label={`Mark “${habit.title}” ${done ? "not done" : "done"} today`} onToggle={toggle} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{habit.title}</p>
        <p className="text-xs text-muted">{describeRecurrence(habit.recurrence)}</p>
      </div>
      <div className="hidden gap-1 sm:flex" aria-label="Last 7 days">
        {habit.week.map((d, i) => (
          <span
            key={i}
            title={d === null ? "Not scheduled" : d ? "Done" : "Missed"}
            className={`size-2.5 rounded-sm ${d === null ? "bg-transparent ring-1 ring-line" : d || (i === 6 && done) ? "bg-success" : "bg-panel-2"}`}
          />
        ))}
      </div>
      <span className={`tabular flex w-12 items-center justify-end gap-1 text-xs ${streak > 0 ? "text-warn" : "text-muted"}`} title="Current streak">
        <Flame className="size-3.5" aria-hidden /> {streak}
      </span>
      <button type="button" aria-label="Edit habit" onClick={() => setEditing(true)} className={`${cls.btnGhost} md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100`}>
        <Pencil className="size-3.5" aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Delete habit"
        onClick={() => window.confirm(`Delete habit “${habit.title}” and its history?`) && start(() => deleteTask(habit.id))}
        className={`${cls.btnGhost} md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100`}
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>
    </li>
  );
}

const REPEAT_OPTIONS = [
  { value: "daily", label: "Every day" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekly", label: "Weekly" },
  { value: "days:1,3,5", label: "Mon / Wed / Fri" },
  { value: "days:2,4", label: "Tue / Thu" },
  { value: "days:0,6", label: "Weekends" },
];

export function TaskForm({
  task,
  horizon,
  options,
  onDone,
  habit = false,
  parentId,
  defaultDue,
  compact = false,
  pathId,
}: {
  task?: Task;
  horizon: Horizon;
  options: TaskFormOptions;
  onDone?: () => void;
  habit?: boolean;
  parentId?: string;
  defaultDue?: Day;
  compact?: boolean;
  /** create the task inside this Path (hides the Path picker) */
  pathId?: string;
}) {
  const [state, action] = useActionState(task ? updateTask : createTask, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [more, setMore] = useState(Boolean(task) && !compact);
  const key = task?.id ?? `new-${horizon}-${habit ? "h" : "t"}-${parentId ?? ""}`;

  useEffect(() => {
    if (!state?.ok) return;
    if (task) onDone?.();
    else {
      formRef.current?.reset();
      formRef.current?.querySelector<HTMLInputElement>("input[name=title]")?.focus();
    }
  }, [state, task, onDone]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2">
      {task ? <input type="hidden" name="id" value={task.id} /> : null}
      <input type="hidden" name="horizon" value={horizon} />
      {pathId ? <input type="hidden" name="pathId" value={pathId} /> : null}
      {parentId ?? task?.parentId ? <input type="hidden" name="parentId" value={parentId ?? task?.parentId ?? ""} /> : null}
      <div className="flex gap-2">
        <label className="sr-only" htmlFor={`t-title-${key}`}>
          {habit ? "Habit" : "Task"}
        </label>
        <input
          id={`t-title-${key}`}
          name="title"
          required
          maxLength={300}
          defaultValue={task?.title}
          placeholder={habit ? "New habit — e.g. Solve 2 CF problems" : parentId ? "Add a step…" : "Add a task…"}
          className={cls.input}
          autoComplete="off"
        />
        <SubmitButton pendingLabel="…">{task ? "Save" : "Add"}</SubmitButton>
        {task ? (
          <button type="button" onClick={onDone} className={cls.btn}>
            Cancel
          </button>
        ) : null}
      </div>
      {habit ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted" htmlFor={`t-rec-${key}`}>
            Repeats
          </label>
          <select id={`t-rec-${key}`} name="recurrence" defaultValue={task?.recurrence ?? "daily"} className={cls.select}>
            {REPEAT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {!habit && !more ? (
        <button type="button" onClick={() => setMore(true)} className="-my-1 self-start py-1.5 text-xs text-muted transition-colors duration-150 hover:text-fg">
          + date, priority, area…
        </button>
      ) : null}
      {!habit && more ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div>
            <label className={cls.label} htmlFor={`t-due-${key}`}>
              Due
            </label>
            <input id={`t-due-${key}`} name="dueDate" type="date" defaultValue={task?.dueDate ?? defaultDue ?? ""} className={cls.input} />
          </div>
          <div>
            <label className={cls.label} htmlFor={`t-pri-${key}`}>
              Priority
            </label>
            <select id={`t-pri-${key}`} name="priority" defaultValue={task?.priority ?? ""} className={`${cls.select} w-full`}>
              <option value="">—</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label className={cls.label} htmlFor={`t-area-${key}`}>
              Area
            </label>
            <input id={`t-area-${key}`} name="area" list={`areas-${key}`} defaultValue={task?.area ?? ""} placeholder="college, GRE…" maxLength={60} className={cls.input} />
            <datalist id={`areas-${key}`}>
              {options.areas.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </div>
          <div>
            <label className={cls.label} htmlFor={`t-effort-${key}`}>
              Effort
            </label>
            <select id={`t-effort-${key}`} name="effort" defaultValue={task?.effort ?? ""} className={`${cls.select} w-full`}>
              <option value="">—</option>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>
          {task ? (
            <div>
              <label className={cls.label} htmlFor={`t-status-${key}`}>
                Status
              </label>
              <select id={`t-status-${key}`} name="status" defaultValue={task.status} className={`${cls.select} w-full`}>
                {Object.entries(STATUS_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {options.paths.length && !pathId ? (
            <div className={task ? "" : "col-span-2 sm:col-span-1"}>
              <label className={cls.label} htmlFor={`t-path-${key}`}>
                Path
              </label>
              <select id={`t-path-${key}`} name="pathId" defaultValue={task?.pathId ?? ""} className={`${cls.select} w-full`}>
                <option value="">—</option>
                {options.paths.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="col-span-2 sm:col-span-4">
            <label className={cls.label} htmlFor={`t-desc-${key}`}>
              Notes
            </label>
            <textarea id={`t-desc-${key}`} name="description" rows={2} maxLength={5_000} defaultValue={task?.description ?? ""} className={cls.textarea} />
          </div>
        </div>
      ) : null}
      <FormMessage state={state?.ok ? null : state} />
    </form>
  );
}
