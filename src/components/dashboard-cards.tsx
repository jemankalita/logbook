import Link from "next/link";
import { Bookmark, CheckSquare, Flame, Trophy, type LucideIcon } from "lucide-react";
import type { Day } from "@/lib/dates";
import { countdownLabel, upcomingDeadlines, type Deadline } from "@/lib/queries/opportunities";
import type { Habit, Task } from "@/lib/queries/tasks";
import { cls } from "./cls";
import { CardHeader, Kbd, Progress } from "./page-ui";

const DEADLINE_DAYS = 21;
const URGENT_DAYS = 3;
const DEADLINE_ICON: Record<Deadline["kind"], LucideIcon> = { opportunity: Trophy, task: CheckSquare, link: Bookmark };
const MAX_TASKS = 5;
const MAX_HABITS = 3;

export function TodayCard({ todayDay, tasks, habits }: { todayDay: Day; tasks: Task[]; habits: Habit[] }) {
  const open = tasks.filter((t) => t.status !== "done");
  const doneCount = tasks.length - open.length + habits.filter((h) => h.doneToday).length;
  const total = tasks.length + habits.length;
  const openHabits = habits.filter((h) => !h.doneToday);

  return (
    <section className={`${cls.card} flex flex-col p-5`}>
      <CardHeader title="Today" href="/tasks" linkLabel="Tasks" />
      {total === 0 ? (
        <>
          <p className="font-display text-[1.6rem] leading-tight">Nothing planned yet</p>
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-muted">
            Press <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd> and type a task to add one.
          </p>
        </>
      ) : (
        <>
          <p className="tabular flex items-baseline gap-1.5">
            <span className="text-[1.75rem] font-medium leading-none tracking-[-0.03em]">{doneCount}</span>
            <span className="text-sm text-faint">of {total} done</span>
          </p>
          <div className="mt-3">
            <Progress value={doneCount} max={total} label="Done today" />
          </div>
          <ul className="mt-4 flex flex-col gap-2 text-sm">
            {open.slice(0, MAX_TASKS).map((t) => (
              <li key={t.id} className="flex items-center gap-2.5">
                <span aria-hidden className="size-3.5 shrink-0 rounded-[4px] border border-line-strong" />
                <span className="truncate">{t.title}</span>
                {t.dueDate && t.dueDate < todayDay ? <span className="ml-auto shrink-0 text-xs text-danger">overdue</span> : null}
              </li>
            ))}
            {openHabits.slice(0, MAX_HABITS).map((h) => (
              <li key={h.id} className="flex items-center gap-2.5 text-muted">
                <span aria-hidden className="size-3.5 shrink-0 rounded-full border border-line-strong" />
                <span className="truncate">{h.title}</span>
                {h.streak ? (
                  <span className="tabular ml-auto inline-flex shrink-0 items-center gap-0.5 text-xs text-warn">
                    <Flame className="size-3" aria-hidden />
                    {h.streak}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          {open.length > MAX_TASKS ? <p className="mt-2 text-xs text-faint">+{open.length - MAX_TASKS} more</p> : null}
          {open.length === 0 && openHabits.length === 0 ? <p className="mt-1 text-sm text-muted">All clear for today.</p> : null}
        </>
      )}
    </section>
  );
}

function countdownTone(daysLeft: number): string {
  if (daysLeft < 0) return "border-danger/30 bg-danger/10 text-danger";
  if (daysLeft <= URGENT_DAYS) return "border-warn/30 bg-warn/10 text-warn";
  return "border-line bg-panel-2 text-muted";
}

export async function DeadlinesCard({ todayDay }: { todayDay: Day }) {
  const deadlines = await upcomingDeadlines(todayDay, DEADLINE_DAYS);
  return (
    <section className={`${cls.card} flex flex-col p-5`}>
      <CardHeader title="Deadlines" count={deadlines.length || undefined} href="/opportunities" linkLabel="Opportunities" />
      {deadlines.length === 0 ? (
        <p className="py-1 text-sm leading-relaxed text-muted">Nothing due in the next {DEADLINE_DAYS} days. Deadlines on opportunities, tasks and saved links show up here.</p>
      ) : (
        <ul className="-mx-2 max-h-72 overflow-y-auto">
          {deadlines.map((d) => {
            const Icon = DEADLINE_ICON[d.kind];
            return (
              <li key={`${d.kind}-${d.id}`}>
                <Link href={d.href} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors duration-150 hover:bg-panel-2">
                  <Icon className="size-4 shrink-0 text-faint" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{d.title}</span>
                  <span className={`tabular shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-4 ${countdownTone(d.daysLeft)}`}>{countdownLabel(d.daysLeft)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
