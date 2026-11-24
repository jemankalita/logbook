"use client";

import { useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { AlertCircle, Calendar, CalendarClock, CalendarX, ChevronRight, CircleDot, Gauge, List, Plus, Search, Signal, Table2, Trash2, Type } from "lucide-react";
import { deleteTask, fixOverdueTasks, setTaskField, setTaskStatus } from "@/app/(app)/tasks/actions";
import type { Day } from "@/lib/dates";
import type { Task } from "@/lib/queries/tasks";
import { cls } from "../cls";
import { TaskForm, type TaskFormOptions } from "./task-ui";

/** Notion's select colours, mapped onto the app's tokens so both themes stay readable. */
const STATUS = {
  not_started: { label: "Not started", pill: "bg-panel-3 text-muted", dot: "bg-faint" },
  in_progress: { label: "In progress", pill: "bg-accent/15 text-accent", dot: "bg-accent" },
  done: { label: "Done", pill: "bg-success/15 text-success", dot: "bg-success" },
} as const;
const PRIORITY = {
  high: { label: "High", pill: "bg-danger/15 text-danger" },
  medium: { label: "Medium", pill: "bg-warn/15 text-warn" },
  low: { label: "Low", pill: "bg-success/15 text-success" },
} as const;
const EFFORT = {
  small: { label: "Small", pill: "bg-success/15 text-success" },
  medium: { label: "Medium", pill: "bg-warn/15 text-warn" },
  large: { label: "Large", pill: "bg-danger/15 text-danger" },
} as const;

type Layout = "table" | "checklist";
const LAYOUT_KEY = "logbook.tasks.layout";

function readLayout(): Layout {
  try {
    return window.localStorage.getItem(LAYOUT_KEY) === "checklist" ? "checklist" : "table";
  } catch {
    return "table";
  }
}

export interface TaskTableProps {
  title: string;
  description: string;
  horizon: "daily" | "upcoming";
  tasks: Task[];
  today: Day;
  options: TaskFormOptions;
  /** Daily Tasks has an Effort column in Notion; Overall To-Do doesn't. */
  showEffort: boolean;
}

/** A Notion-style database: table or checklist layout, inline-editable cells, done rows tucked away. */
export function TaskTable({ title, description, horizon, tasks, today, options, showEffort }: TaskTableProps) {
  const [layout, setLayout] = useState<Layout>("table");
  useEffect(() => setLayout(readLayout()), []);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? tasks.filter((t) => `${t.title} ${t.description ?? ""} ${t.area ?? ""}`.toLowerCase().includes(q)) : tasks;
  }, [tasks, query]);
  const open = filtered.filter((t) => t.status !== "done");
  const done = filtered.filter((t) => t.status === "done");
  const pastDue = open.filter((t) => t.dueDate && t.dueDate < today).length;
  // The bulk fix acts on the whole list, so count without the search filter.
  const totalPastDue = tasks.filter((t) => t.status !== "done" && t.dueDate && t.dueDate < today).length;

  const pick = (l: Layout) => {
    setLayout(l);
    try {
      window.localStorage.setItem(LAYOUT_KEY, l);
    } catch {
      // private mode: the choice lasts for this visit
    }
  };

  const cols = showEffort ? "grid-cols-[minmax(15rem,1fr)_8.5rem_9.5rem_6.5rem_6.5rem_2.25rem]" : "grid-cols-[minmax(15rem,1fr)_8.5rem_9.5rem_6.5rem_2.25rem]";

  return (
    <section className={`${cls.card} overflow-hidden`}>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line px-5 py-4">
        {/* min width forces the title onto its own row on phones instead of squeezing beside the search box */}
        <div className="min-w-[min(100%,18rem)] flex-1">
          <h2 className="text-lg font-semibold tracking-[-0.01em]">{title}</h2>
          <p className="mt-0.5 text-[13px] text-muted">
            {description}
            <span className="tabular text-faint">
              {" "}
              · {tasks.filter((t) => t.status !== "done").length} open · {tasks.filter((t) => t.status === "done").length} done
              {pastDue ? <span className="text-danger"> · {pastDue} past due</span> : null}
            </span>
          </p>
        </div>
        <label className="relative">
          <span className="sr-only">Search {title}</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className={`${cls.input} h-8 w-40 pl-8 sm:w-44`} />
        </label>
        <div className={cls.segment} role="group" aria-label="Layout">
          {(
            [
              { id: "table", label: "Table", Icon: Table2 },
              { id: "checklist", label: "Checklist", Icon: List },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button key={id} type="button" aria-pressed={layout === id} onClick={() => pick(id)} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors duration-150 ${layout === id ? "bg-panel-3 text-fg shadow-raised" : "text-muted hover:text-fg"}`}>
              <Icon className="size-3.5" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </header>

      {totalPastDue ? <OverdueBar count={totalPastDue} horizon={horizon} /> : null}

      {layout === "table" ? (
        <div className="overflow-x-auto">
          <div className="min-w-[44rem]" role="table" aria-label={title}>
            <div role="row" className={`grid ${cols} border-b border-line text-[12px] text-faint`}>
              <HeaderCell Icon={Type}>Task name</HeaderCell>
              <HeaderCell Icon={CircleDot}>Status</HeaderCell>
              <HeaderCell Icon={Calendar}>Due date</HeaderCell>
              <HeaderCell Icon={Signal}>Priority</HeaderCell>
              {showEffort ? <HeaderCell Icon={Gauge}>Effort</HeaderCell> : null}
              <span role="columnheader" aria-label="Actions" />
            </div>
            {open.map((t) => (
              <TableRow key={t.id} task={t} today={today} cols={cols} showEffort={showEffort} options={options} horizon={horizon} />
            ))}
            {done.length ? (
              <>
                <button type="button" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone} className="flex w-full items-center gap-1.5 border-b border-line bg-panel-2/30 px-4 py-2 text-left text-[12px] font-medium text-muted transition-colors duration-150 hover:text-fg">
                  <ChevronRight className={`size-3.5 transition-transform duration-200 ${showDone ? "rotate-90" : ""}`} aria-hidden />
                  Done <span className="tabular text-faint">{done.length}</span>
                </button>
                {showDone ? done.map((t) => <TableRow key={t.id} task={t} today={today} cols={cols} showEffort={showEffort} options={options} horizon={horizon} />) : null}
              </>
            ) : null}
          </div>
        </div>
      ) : (
        <ul className="px-3 py-2">
          {[...open, ...(showDone ? done : [])].map((t) => (
            <ChecklistRow key={t.id} task={t} today={today} />
          ))}
          {done.length ? (
            <li>
              <button type="button" onClick={() => setShowDone((v) => !v)} className="px-2 py-2 text-[12px] text-muted hover:text-fg">
                {showDone ? "Hide" : "Show"} {done.length} done
              </button>
            </li>
          ) : null}
        </ul>
      )}

      {filtered.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted">{query ? "No tasks match that search." : "No tasks yet. Add the first one below."}</p> : null}

      <footer className="border-t border-line px-3 py-2">
        {adding ? (
          <div className="px-2 py-2">
            <TaskForm horizon={horizon} options={options} onDone={() => setAdding(false)} />
          </div>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className={`${cls.btnGhost} gap-2`}>
            <Plus className="size-4" aria-hidden />
            New task
          </button>
        )}
      </footer>
    </section>
  );
}

/** Past-due tasks nag forever otherwise: one click moves them all to today or clears their dates. */
function OverdueBar({ count, horizon }: { count: number; horizon: "daily" | "upcoming" }) {
  const [pending, start] = useTransition();
  const run = (fix: "today" | "clear") => start(() => fixOverdueTasks(horizon, fix));
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-danger/[0.06] px-5 py-2.5 text-[13px]">
      <AlertCircle className="size-4 shrink-0 text-danger" aria-hidden />
      <span className="min-w-[min(100%,11rem)] flex-1 text-muted">
        <span className="font-medium text-fg">{count}</span> {count === 1 ? "task is" : "tasks are"} past due.
      </span>
      <button type="button" disabled={pending} onClick={() => run("today")} className={`${cls.btn} h-7 px-2.5 text-[12px]`}>
        <CalendarClock className="size-3.5" aria-hidden /> Move to today
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => window.confirm(`Remove the due date from ${count} past-due ${count === 1 ? "task" : "tasks"}?`) && run("clear")}
        className={`${cls.btnGhost} h-7 text-[12px]`}
      >
        <CalendarX className="size-3.5" aria-hidden /> Clear dates
      </button>
    </div>
  );
}

function HeaderCell({ Icon, children }: { Icon: typeof Type; children: React.ReactNode }) {
  return (
    <span role="columnheader" className="flex items-center gap-1.5 border-r border-line px-3 py-2 last:border-r-0">
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {children}
    </span>
  );
}

/** A coloured select that looks like a Notion pill but is a real <select> (keyboard + screen-reader friendly). */
function PillSelect<K extends string>({ value, options, label, onChange, allowEmpty = true }: { value: K | null; options: Record<K, { label: string; pill: string }>; label: string; onChange: (v: string) => void; allowEmpty?: boolean }) {
  const current = value ? options[value] : null;
  return (
    <span className="relative inline-flex max-w-full">
      <span className={`pointer-events-none inline-flex h-6 items-center truncate rounded-md px-2 text-[12px] font-medium ${current ? current.pill : "text-transparent group-hover:text-faint"}`}>{current ? current.label : "Empty"}</span>
      <select aria-label={label} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
        {allowEmpty ? <option value="">Empty</option> : null}
        {(Object.keys(options) as K[]).map((k) => (
          <option key={k} value={k}>
            {options[k].label}
          </option>
        ))}
      </select>
    </span>
  );
}

function TableRow({ task, today, cols, showEffort, options, horizon }: { task: Task; today: Day; cols: string; showEffort: boolean; options: TaskFormOptions; horizon: "daily" | "upcoming" }) {
  const [view, setView] = useOptimistic(task);
  const [editing, setEditing] = useState(false);
  const [, start] = useTransition();
  const isDone = view.status === "done";
  const late = !isDone && view.dueDate !== null && view.dueDate < today;

  const change = (patch: Partial<Task>, run: () => Promise<void>) =>
    start(async () => {
      setView({ ...view, ...patch });
      await run();
    });

  const cell = "flex min-w-0 items-center border-r border-line px-3 py-1.5";
  return (
    <div role="rowgroup">
      <div role="row" className={`group grid ${cols} border-b border-line text-sm transition-colors duration-150 hover:bg-panel-2/40`}>
        <span role="cell" className={`${cell} gap-2.5`}>
          <button
            type="button"
            role="checkbox"
            aria-checked={isDone}
            aria-label={`Mark “${view.title}” ${isDone ? "not done" : "done"}`}
            onClick={() => change({ status: isDone ? "not_started" : "done" }, () => setTaskStatus(task.id, isDone ? "not_started" : "done"))}
            className={`relative grid size-4 shrink-0 place-items-center rounded-[4px] border transition-colors duration-150 after:absolute after:-inset-2 ${isDone ? "border-success bg-success" : "border-muted/60 hover:border-fg"}`}
          >
            {isDone ? (
              <svg viewBox="0 0 12 12" className="size-3 text-bg" aria-hidden>
                <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : null}
          </button>
          <button type="button" onClick={() => setEditing((v) => !v)} className={`min-w-0 truncate text-left font-medium underline-offset-4 hover:underline ${isDone ? "text-muted line-through decoration-faint" : ""}`} title="Open">
            {view.title}
          </button>
          {view.area ? <span className={`${cls.chip} hidden shrink-0 sm:inline-flex`}>{view.area}</span> : null}
        </span>
        <span role="cell" className={cell}>
          <PillSelect value={view.status} options={STATUS} label="Status" allowEmpty={false} onChange={(v) => change({ status: v as Task["status"] }, () => setTaskStatus(task.id, v))} />
        </span>
        <span role="cell" className={`${cell} gap-1.5`}>
          <input
            type="date"
            aria-label="Due date"
            value={view.dueDate ?? ""}
            onChange={(e) => change({ dueDate: e.target.value || null }, () => setTaskField(task.id, "dueDate", e.target.value))}
            className={`tabular w-full min-w-0 bg-transparent text-[13px] outline-none [color-scheme:inherit] ${late ? "text-danger" : view.dueDate ? "text-fg" : "text-transparent focus:text-fg group-hover:text-faint [&::-webkit-calendar-picker-indicator]:opacity-0 group-hover:[&::-webkit-calendar-picker-indicator]:opacity-60"}`}
          />
          {late ? <AlertCircle className="size-3.5 shrink-0 text-danger" aria-label="Past due" /> : null}
        </span>
        <span role="cell" className={cell}>
          <PillSelect value={view.priority} options={PRIORITY} label="Priority" onChange={(v) => change({ priority: (v || null) as Task["priority"] }, () => setTaskField(task.id, "priority", v))} />
        </span>
        {showEffort ? (
          <span role="cell" className={cell}>
            <PillSelect value={view.effort} options={EFFORT} label="Effort" onChange={(v) => change({ effort: (v || null) as Task["effort"] }, () => setTaskField(task.id, "effort", v))} />
          </span>
        ) : null}
        <span role="cell" className="flex items-center justify-center">
          <button
            type="button"
            aria-label={`Delete “${view.title}”`}
            onClick={() => window.confirm(`Delete “${view.title}”?`) && start(() => deleteTask(task.id))}
            className="grid size-7 place-items-center rounded-md text-faint opacity-0 transition-[opacity,color,background-color] duration-150 hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        </span>
      </div>
      {editing ? (
        <div className="border-b border-line bg-panel-2/40 px-5 py-4">
          {view.description ? <p className="mb-3 whitespace-pre-wrap text-sm leading-relaxed text-muted">{view.description}</p> : null}
          <TaskForm task={task} horizon={horizon} options={options} onDone={() => setEditing(false)} />
        </div>
      ) : null}
    </div>
  );
}

/** Notion's "Checklist" view: just the status and the name. */
function ChecklistRow({ task, today }: { task: Task; today: Day }) {
  const [view, setView] = useOptimistic(task);
  const [, start] = useTransition();
  const isDone = view.status === "done";
  const late = !isDone && view.dueDate !== null && view.dueDate < today;
  const toggle = () =>
    start(async () => {
      setView({ ...view, status: isDone ? "not_started" : "done" });
      await setTaskStatus(task.id, isDone ? "not_started" : "done");
    });
  return (
    <li>
      <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors duration-150 hover:bg-panel-2/60">
        <input type="checkbox" checked={isDone} onChange={toggle} className="size-4 shrink-0" />
        <span className={`min-w-0 flex-1 truncate ${isDone ? "text-muted line-through" : ""}`}>{view.title}</span>
        {view.status === "in_progress" ? <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${STATUS.in_progress.pill}`}>In progress</span> : null}
        {late ? <span className="text-[11px] font-medium text-danger">Past due</span> : null}
      </label>
    </li>
  );
}
