import Link from "next/link";
import type { Day } from "@/lib/dates";
import { countdownLabel, upcomingDeadlines, type Deadline } from "@/lib/queries/opportunities";
import type { Habit, Task } from "@/lib/queries/tasks";

const DEADLINE_DAYS = 21;
const DEADLINE_ICON: Record<Deadline["kind"], string> = { opportunity: "🏆", task: "✅", link: "🔖" };
const MAX_TASKS = 5;
const MAX_HABITS = 3;

function CardHeader({ title, href, linkLabel }: { title: string; href: string; linkLabel: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <h2 className="text-sm font-medium text-muted">{title}</h2>
      <Link href={href} className="text-xs text-muted transition-colors hover:text-fg">
        {linkLabel} →
      </Link>
    </div>
  );
}

export function TodayCard({ todayDay, tasks, habits }: { todayDay: Day; tasks: Task[]; habits: Habit[] }) {
  const open = tasks.filter((t) => t.status !== "done");
  const doneCount = tasks.length - open.length + habits.filter((h) => h.doneToday).length;
  const total = tasks.length + habits.length;

  return (
    <section className="flex flex-col rounded-2xl border border-line bg-panel p-5">
      <CardHeader title="Today" href="/tasks" linkLabel="Tasks" />
      <p className="text-lg font-semibold">{total === 0 ? "Nothing planned yet" : `${doneCount} of ${total} done`}</p>
      {total ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel-2" role="progressbar" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={total} aria-label="Done today">
          <div className="h-full bg-success" style={{ width: `${(doneCount / total) * 100}%` }} />
        </div>
      ) : null}
      <ul className="mt-3 flex flex-col gap-1 text-sm">
        {open.slice(0, MAX_TASKS).map((t) => (
          <li key={t.id} className="flex items-center gap-2">
            <span aria-hidden className="size-3.5 shrink-0 rounded border border-muted/60" />
            <span className="truncate">{t.title}</span>
            {t.dueDate && t.dueDate < todayDay ? <span className="ml-auto shrink-0 text-xs text-danger">overdue</span> : null}
          </li>
        ))}
        {habits
          .filter((h) => !h.doneToday)
          .slice(0, MAX_HABITS)
          .map((h) => (
            <li key={h.id} className="flex items-center gap-2 text-muted">
              <span aria-hidden className="size-3.5 shrink-0 rounded-full border border-muted/60" />
              <span className="truncate">{h.title}</span>
              {h.streak ? <span className="ml-auto shrink-0 text-xs text-orange-400">🔥 {h.streak}</span> : null}
            </li>
          ))}
      </ul>
      {open.length > MAX_TASKS ? <p className="mt-1 text-xs text-muted">+{open.length - MAX_TASKS} more</p> : null}
      {total === 0 ? <p className="mt-1 text-sm text-muted">Press Ctrl+K and type a task to add one.</p> : null}
    </section>
  );
}

export async function DeadlinesCard({ todayDay }: { todayDay: Day }) {
  const deadlines = await upcomingDeadlines(todayDay, DEADLINE_DAYS);
  return (
    <section className="flex flex-col rounded-2xl border border-line bg-panel p-5">
      <CardHeader title={`Deadlines · next ${DEADLINE_DAYS} days`} href="/opportunities" linkLabel="Opportunities" />
      {deadlines.length === 0 ? (
        <p className="py-2 text-sm text-muted">Nothing due. Add deadlines to opportunities, tasks or saved links.</p>
      ) : (
        <ul className="-mx-2 max-h-64 overflow-y-auto">
          {deadlines.map((d) => (
            <li key={`${d.kind}-${d.id}`}>
              <Link href={d.href} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-panel-2">
                <span aria-hidden>{DEADLINE_ICON[d.kind]}</span>
                <span className="min-w-0 flex-1 truncate">{d.title}</span>
                <span className={`tabular shrink-0 text-xs ${d.daysLeft < 0 ? "text-danger" : d.daysLeft <= 3 ? "text-orange-400" : "text-muted"}`}>{countdownLabel(d.daysLeft)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
