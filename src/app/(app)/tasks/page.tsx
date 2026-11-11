import Link from "next/link";
import { cls } from "@/components/cls";
import { HabitRow, TaskForm, TaskRow, type TaskFormOptions } from "@/components/tasks/task-ui";
import { addDays, diffDays, formatDay, today as getToday, type Day } from "@/lib/dates";
import { getAreas, getHabits, getPathOptions, getRoadmap, getTodayTasks, getUpcomingTasks, TASK_HORIZONS, type Horizon, type Task } from "@/lib/queries/tasks";
import { setTaskStatus } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tasks · Logbook" };

const VIEW_LABELS: Record<Horizon, string> = { daily: "Today", upcoming: "Upcoming", roadmap: "Roadmap" };

function Section({ title, count, children, action }: { title: string; count?: number; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className={`${cls.card} p-4`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-medium">
          {title}
          {count !== undefined ? <span className="tabular ml-2 text-sm font-normal text-muted">{count}</span> : null}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

async function TodayView({ today, options }: { today: Day; options: TaskFormOptions }) {
  const [habits, todays] = await Promise.all([getHabits(today), getTodayTasks(today)]);
  const open = todays.filter((t) => t.status !== "done");
  const done = todays.filter((t) => t.status === "done");
  const habitsDone = habits.scheduled.filter((h) => h.doneToday).length;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Today's tasks" count={open.length}>
        <TaskForm horizon="daily" options={options} compact />
        <ul className="mt-2 flex flex-col">
          {open.map((t) => (
            <TaskRow key={t.id} task={t} today={today} options={options} />
          ))}
        </ul>
        {open.length === 0 ? <p className="px-2 py-3 text-sm text-muted">{done.length ? "All clear for today. 🎉" : "Nothing planned. Add something above or press Ctrl+K."}</p> : null}
        {done.length ? (
          <details className="mt-2">
            <summary className="cursor-pointer px-2 text-xs text-muted">Done today ({done.length})</summary>
            <ul className="mt-1 flex flex-col">
              {done.map((t) => (
                <TaskRow key={t.id} task={t} today={today} options={options} />
              ))}
            </ul>
          </details>
        ) : null}
      </Section>

      <Section title="Habits" count={habits.scheduled.length ? undefined : 0} action={habits.scheduled.length ? <span className="tabular text-sm text-muted">{habitsDone}/{habits.scheduled.length} today</span> : null}>
        <ul className="flex flex-col">
          {habits.scheduled.map((h) => (
            <HabitRow key={h.id} habit={h} options={options} />
          ))}
        </ul>
        {habits.scheduled.length === 0 ? <p className="px-2 py-2 text-sm text-muted">No habits scheduled today.</p> : null}
        {habits.other.length ? (
          <details className="mt-2">
            <summary className="cursor-pointer px-2 text-xs text-muted">Not scheduled today ({habits.other.length})</summary>
            <ul className="mt-1 flex flex-col">
              {habits.other.map((h) => (
                <HabitRow key={h.id} habit={h} options={options} />
              ))}
            </ul>
          </details>
        ) : null}
        <div className="mt-3 border-t border-line pt-3">
          <TaskForm horizon="daily" options={options} habit />
        </div>
      </Section>
    </div>
  );
}

function bucketFor(task: Task, today: Day): string {
  if (!task.dueDate) return "Someday";
  const d = diffDays(task.dueDate, today);
  if (d === 1) return "Tomorrow";
  if (d <= 7) return "Next 7 days";
  if (d <= 31) return "This month";
  return "Later";
}

async function UpcomingView({ today, options }: { today: Day; options: TaskFormOptions }) {
  const rows = await getUpcomingTasks(today);
  const order = ["Tomorrow", "Next 7 days", "This month", "Later", "Someday"];
  const groups = new Map<string, Task[]>(order.map((b) => [b, []]));
  for (const t of rows) groups.get(bucketFor(t, today))?.push(t);

  return (
    <div className="flex flex-col gap-4">
      <section className={`${cls.card} p-4`}>
        <TaskForm horizon="upcoming" options={options} defaultDue={addDays(today, 1)} />
      </section>
      {rows.length === 0 ? <p className="text-sm text-muted">Nothing coming up.</p> : null}
      {order
        .filter((b) => groups.get(b)?.length)
        .map((b) => (
          <Section key={b} title={b} count={groups.get(b)?.length}>
            <ul className="flex flex-col">
              {groups.get(b)?.map((t) => (
                <TaskRow key={t.id} task={t} today={today} options={options} />
              ))}
            </ul>
          </Section>
        ))}
    </div>
  );
}

const STATUS_COLUMNS = [
  { status: "not_started", label: "Not started" },
  { status: "in_progress", label: "In progress" },
  { status: "done", label: "Done" },
] as const;

async function RoadmapView({ today, options }: { today: Day; options: TaskFormOptions }) {
  const items = await getRoadmap();
  return (
    <div className="flex flex-col gap-4">
      <section className={`${cls.card} p-4`}>
        <p className="mb-2 text-sm text-muted">Big goals that take weeks or months. Break each into steps; link it to a Path to see it there too.</p>
        <TaskForm horizon="roadmap" options={options} />
      </section>
      <div className="grid gap-4 lg:grid-cols-3">
        {STATUS_COLUMNS.map((col) => {
          const list = items.filter((i) => i.status === col.status);
          return (
            <Section key={col.status} title={col.label} count={list.length}>
              <ul className="flex flex-col gap-3">
                {list.map((item) => {
                  const doneSteps = item.children.filter((c) => c.status === "done").length;
                  return (
                    <li key={item.id} className="rounded-xl border border-line bg-panel-2/40 p-2">
                      <ul>
                        <TaskRow task={item} today={today} options={options} pathName={item.pathName} />
                      </ul>
                      {item.children.length ? (
                        <div className="mx-2 mb-1 h-1 overflow-hidden rounded-full bg-panel-2" role="progressbar" aria-valuemin={0} aria-valuemax={item.children.length} aria-valuenow={doneSteps} aria-label="Steps done">
                          <div className="h-full bg-success" style={{ width: `${(doneSteps / item.children.length) * 100}%` }} />
                        </div>
                      ) : null}
                      <ul className="ml-6 flex flex-col">
                        {item.children.map((c) => (
                          <TaskRow key={c.id} task={c} today={today} options={options} />
                        ))}
                      </ul>
                      <div className="ml-8 mt-1">
                        <TaskForm horizon="roadmap" options={options} parentId={item.id} compact />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1 px-2">
                        {STATUS_COLUMNS.filter((s) => s.status !== item.status).map((s) => (
                          <form key={s.status} action={setTaskStatus.bind(null, item.id, s.status)}>
                            <button type="submit" className="rounded-md border border-line px-2 py-0.5 text-xs text-muted hover:text-fg">
                              → {s.label}
                            </button>
                          </form>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {list.length === 0 ? <p className="px-2 py-2 text-sm text-muted">—</p> : null}
            </Section>
          );
        })}
      </div>
    </div>
  );
}

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view: rawView } = await searchParams;
  const view: Horizon = (TASK_HORIZONS as readonly string[]).includes(rawView ?? "") ? (rawView as Horizon) : "daily";
  const today = getToday();
  const [paths, areas] = await Promise.all([getPathOptions(), getAreas()]);
  const options: TaskFormOptions = { paths, areas };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{formatDay(today, { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className={cls.h1}>Tasks</h1>
        </div>
        <nav className="flex rounded-lg border border-line bg-panel-2 p-0.5 text-sm" aria-label="Task views">
          {TASK_HORIZONS.map((h) => (
            <Link
              key={h}
              href={h === "daily" ? "/tasks" : `/tasks?view=${h}`}
              aria-current={h === view ? "page" : undefined}
              className={`rounded-md px-3 py-1 transition-colors ${h === view ? "bg-panel text-fg shadow" : "text-muted hover:text-fg"}`}
            >
              {VIEW_LABELS[h]}
            </Link>
          ))}
        </nav>
      </header>
      {view === "daily" ? <TodayView today={today} options={options} /> : view === "upcoming" ? <UpcomingView today={today} options={options} /> : <RoadmapView today={today} options={options} />}
    </div>
  );
}
