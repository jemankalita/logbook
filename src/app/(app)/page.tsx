import Link from "next/link";
import { CalendarCheck, Flame, Sparkles, Trophy } from "lucide-react";
import { CalendarSetup, EventRow, SyncedLabel } from "@/components/calendar-ui";
import { CheckInCard } from "@/components/check-in-card";
import { cls } from "@/components/cls";
import { DeadlinesCard, TodayCard } from "@/components/dashboard-cards";
import { Heatmap } from "@/components/heatmap";
import { ItemCard } from "@/components/library/item-card";
import { CardHeader, PageHeader } from "@/components/page-ui";
import { Segmented } from "@/components/segmented";
import { Stat } from "@/components/stat-tile";
import { buildAgenda } from "@/lib/calendar/agenda";
import { getCalendarSnapshot, type SnapshotResult } from "@/lib/calendar/feeds";
import { appTimezone, formatDay, today, type Day } from "@/lib/dates";
import { buildHeatmap, computeStreaks, HEATMAP_MODES, parseMode, type ActivityInput, type HeatmapMode } from "@/lib/heatmap";
import { getActivity, getAttendanceFor } from "@/lib/queries/activity";
import { recentLinks } from "@/lib/queries/library";
import { getHabits, getTodayTasks } from "@/lib/queries/tasks";

export const dynamic = "force-dynamic";

const HEATMAP_WEEKS = 53;
const RECENT_LINKS = 3;

const MODE_LABELS: Record<HeatmapMode, string> = {
  attendance: "Attendance",
  tasks: "Tasks done",
  combined: "Combined",
};

function activeDays(mode: HeatmapMode, activity: ActivityInput): Day[] {
  const taskDays = [...activity.tasksByDay].filter(([, n]) => n > 0).map(([d]) => d);
  if (mode === "attendance") return [...activity.attendedDays];
  if (mode === "tasks") return taskDays;
  return [...new Set([...activity.attendedDays, ...taskDays])];
}

function greeting(timeZone: string): string {
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone }).format(new Date()));
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function TodaySchedule({ result, todayDay, timeZone, now }: { result: SnapshotResult; todayDay: Day; timeZone: string; now: Date }) {
  if (result.state === "unconfigured") return <CalendarSetup compact />;

  const [day] = result.state === "ok" ? buildAgenda(result.snapshot.events, todayDay, 1, timeZone) : [];
  const events = day ? [...day.allDay, ...day.timed] : [];

  return (
    <section className={`${cls.card} flex flex-col p-5`}>
      <CardHeader title="Schedule" count={events.length || undefined} href="/calendar" linkLabel="Next 14 days" />
      {result.state === "error" ? (
        <p role="alert" className="text-sm text-danger">
          Couldn&apos;t reach Google Calendar: {result.error}
        </p>
      ) : events.length === 0 ? (
        <p className="py-1 text-sm text-muted">Nothing on the calendar today.</p>
      ) : (
        <ul className="-mx-2 max-h-64 overflow-y-auto">
          {events.map((e) => (
            <EventRow key={e.id} event={e} timeZone={timeZone} now={now} />
          ))}
        </ul>
      )}
      {result.state === "ok" ? (
        <p className="mt-auto pt-3 text-xs text-faint">
          <SyncedLabel fetchedAt={result.snapshot.fetchedAt} now={now} />
        </p>
      ) : null}
    </section>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const mode = parseMode((await searchParams).mode);
  const timeZone = appTimezone();
  const todayDay = today();
  const now = new Date();

  const [activity, todayAttendance, calendar, recent, todayTasks, habits] = await Promise.all([
    getActivity(), // full history so streaks aren't capped at a year
    getAttendanceFor(todayDay),
    getCalendarSnapshot(todayDay),
    recentLinks(RECENT_LINKS),
    getTodayTasks(todayDay),
    getHabits(todayDay),
  ]);

  const heatmap = buildHeatmap(todayDay, mode, activity, HEATMAP_WEEKS);
  const days = activeDays(mode, activity);
  const streaks = computeStreaks(days, todayDay);
  const attendanceStreak = mode === "attendance" ? streaks.current : computeStreaks([...activity.attendedDays], todayDay).current;
  const thisMonth = days.filter((d) => d.startsWith(todayDay.slice(0, 7))).length;

  const checkedInLabel = todayAttendance
    ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(todayAttendance.checkedInAt)
    : null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <PageHeader
        eyebrow={formatDay(todayDay, { weekday: "long", month: "long", day: "numeric" })}
        title={
          <>
            {greeting(timeZone)}, <em className="text-muted">Jeman</em>
          </>
        }
      />

      <div className="rise grid gap-4 lg:grid-cols-3" style={{ "--i": 1 } as React.CSSProperties}>
        <CheckInCard checkedInLabel={checkedInLabel} streak={attendanceStreak} />
        <TodayCard todayDay={todayDay} tasks={todayTasks} habits={habits.scheduled} />
        <TodaySchedule result={calendar} todayDay={todayDay} timeZone={timeZone} now={now} />
      </div>

      <section className={`${cls.card} rise overflow-hidden`} style={{ "--i": 2 } as React.CSSProperties}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
          <div>
            <h2 className="font-display text-2xl leading-none">Your year</h2>
            <p className="mt-1.5 text-xs text-faint">Every square is a day. Green means you showed up.</p>
          </div>
          <Segmented label="Heatmap mode" items={HEATMAP_MODES.map((m) => ({ href: m === "attendance" ? "/" : `/?mode=${m}`, label: MODE_LABELS[m], active: m === mode }))} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 border-y border-line bg-panel-2/30 px-5 py-4 md:grid-cols-4">
          <Stat label="Current streak" value={streaks.current} unit={streaks.current === 1 ? "day" : "days"} icon={Flame} tone={streaks.current > 0 ? "warn" : "default"} />
          <Stat label="Longest streak" value={streaks.longest} unit={streaks.longest === 1 ? "day" : "days"} icon={Trophy} />
          <Stat label="Active days" value={streaks.total} unit="all time" icon={CalendarCheck} />
          <Stat label={formatDay(todayDay, { month: "long" })} value={thisMonth} unit={thisMonth === 1 ? "day" : "days"} icon={Sparkles} />
        </div>

        <div className="p-5">
          <Heatmap
            data={heatmap}
            mode={mode}
            today={todayDay}
            summary={`${plural(streaks.total, "active day")} in total, current streak ${plural(streaks.current, "day")}, ${thisMonth} this month.`}
          />
          {mode !== "attendance" && activity.tasksByDay.size === 0 ? (
            <p className="mt-3 text-xs text-faint">Tick off tasks and habits on the Tasks page and they&apos;ll show up here.</p>
          ) : null}
        </div>
      </section>

      <div className="rise grid gap-4 lg:grid-cols-3" style={{ "--i": 3 } as React.CSSProperties}>
        <DeadlinesCard todayDay={todayDay} />
        <section className="lg:col-span-2">
          <CardHeader title="Recently saved" href="/library" linkLabel="Library" />
          {recent.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {recent.map((item) => (
                <ItemCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className={`${cls.empty} py-10`}>
              Nothing saved yet. Paste a link with <kbd className={cls.kbd}>Ctrl</kbd> <kbd className={cls.kbd}>K</kbd>, or{" "}
              <Link href="/library/import" className="text-fg underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-fg">
                import your bookmarks
              </Link>
              .
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
