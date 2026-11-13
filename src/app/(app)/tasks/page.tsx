import { cls } from "@/components/cls";
import { CardHeader, PageHeader, Progress } from "@/components/page-ui";
import { Segmented } from "@/components/segmented";
import { HabitRow, TaskForm, TaskRow, type TaskFormOptions } from "@/components/tasks/task-ui";
import { addDays, diffDays, formatDay, today as getToday, type Day } from "@/lib/dates";
import { getAreas, getHabits, getPathOptions, getRoadmap, getTodayTasks, getUpcomingTasks, TASK_HORIZONS, type Horizon, type Task } from "@/lib/queries/tasks";
import { setTaskStatus } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tasks · Logbook" };

const VIEW_LABELS: Record<Horizon, string> = { daily: "Today", upcoming: "Upcoming", roadmap: "Roadmap" };
const VIEW_DESCRIPTIONS: Record<Horizon, string> = {
  daily: "What needs doing today, and the habits that keep the streaks alive.",
  upcoming: "Everything with a date ahead of today, grouped by when it lands.",
  roadmap: "Big goals that take weeks or months, broken into steps.",
};

function Section({ title, count, children, action }: { title: string; count?: number; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className={`${cls.card} p-5`}>
      <CardHeader title={title} count={count} action={action} />
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
        {open.length === 0 ? <p className="px-2 py-3 text-sm text-muted">{done.length ? "All clear for today." : "Nothing planned. Add something above or press Ctrl+K."}</p> : null}
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
      <section className={`${cls.card} p-5`}>
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
      <section className={`${cls.card} p-5`}>
        <p className="mb-3 text-sm text-muted">Break each goal into steps; link it to a Path to see it there too.</p>
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
                    <li key={item.id} className="rounded-lg border border-line bg-panel-2/40 p-2">
                      <ul>
                        <TaskRow task={item} today={today} options={options} pathName={item.pathName} />
                      </ul>
                      {item.children.length ? (
                        <div className="mx-2 mb-1"><Progress value={doneSteps} max={item.children.length} label="Steps done" /></div>
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
                            <button type="submit" className="h-6 rounded-md border border-line bg-panel px-2 text-[11px] text-muted transition-colors duration-150 hover:border-line-strong hover:text-fg">
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
    <div className="rise mx-auto flex max-w-6xl flex-col gap-5">
      <PageHeader
        eyebrow={formatDay(today, { weekday: "long", month: "long", day: "numeric" })}
        title="Tasks"
        description={VIEW_DESCRIPTIONS[view]}
        actions={
          <Segmented
            label="Task views"
            items={TASK_HORIZONS.map((h) => ({ href: h === "daily" ? "/tasks" : `/tasks?view=${h}`, label: VIEW_LABELS[h], active: h === view }))}
          />
        }
      />
      {view === "daily" ? <TodayView today={today} options={options} /> : view === "upcoming" ? <UpcomingView today={today} options={options} /> : <RoadmapView today={today} options={options} />}
    </div>
  );
}
