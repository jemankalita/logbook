import Link from "next/link";
import { CalendarSetup, EventRow, SyncedLabel } from "@/components/calendar-ui";
import { CheckInCard } from "@/components/check-in-card";
import { Heatmap } from "@/components/heatmap";
import { StatTile } from "@/components/stat-tile";
import { buildAgenda } from "@/lib/calendar/agenda";
import { getCalendarSnapshot, type SnapshotResult } from "@/lib/calendar/feeds";
import { appTimezone, formatDay, today, type Day } from "@/lib/dates";
import { buildHeatmap, computeStreaks, HEATMAP_MODES, parseMode, type ActivityInput, type HeatmapMode } from "@/lib/heatmap";
import { getActivity, getAttendanceFor } from "@/lib/queries/activity";

export const dynamic = "force-dynamic";

const HEATMAP_WEEKS = 53;

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
  if (result.state === "unconfigured") return <CalendarSetup />;

  const [day] = result.state === "ok" ? buildAgenda(result.snapshot.events, todayDay, 1, timeZone) : [];
  const events = day ? [...day.allDay, ...day.timed] : [];

  return (
    <section className="flex flex-col rounded-2xl border border-line bg-panel p-5">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium text-muted">Today&apos;s schedule</h2>
        <Link href="/calendar" className="text-xs text-muted transition-colors hover:text-fg">
          Next 14 days →
        </Link>
      </div>
      {result.state === "error" ? (
        <p role="alert" className="text-sm text-danger">
          Couldn&apos;t reach Google Calendar: {result.error}
        </p>
      ) : events.length === 0 ? (
        <p className="py-2 text-sm text-muted">Nothing on the calendar today.</p>
      ) : (
        <ul className="-mx-2 max-h-64 overflow-y-auto">
          {events.map((e) => (
            <EventRow key={e.id} event={e} timeZone={timeZone} now={now} />
          ))}
        </ul>
      )}
      {result.state === "ok" ? (
        <p className="mt-auto pt-2 text-xs text-muted">
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

  const [activity, todayAttendance, calendar] = await Promise.all([
    getActivity(), // full history so streaks aren't capped at a year
    getAttendanceFor(todayDay),
    getCalendarSnapshot(todayDay),
  ]);

  const heatmap = buildHeatmap(todayDay, mode, activity, HEATMAP_WEEKS);
  const days = activeDays(mode, activity);
  const streaks = computeStreaks(days, todayDay);
  const thisMonth = days.filter((d) => d.startsWith(todayDay.slice(0, 7))).length;

  const checkedInLabel = todayAttendance
    ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(todayAttendance.checkedInAt)
    : null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <p className="text-sm text-muted">{formatDay(todayDay, { weekday: "long", month: "long", day: "numeric" })}</p>
        <h1 className="mt-1 text-2xl font-semibold md:text-3xl">{greeting(timeZone)}, Jeman</h1>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <CheckInCard checkedInLabel={checkedInLabel} />
        <TodaySchedule result={calendar} todayDay={todayDay} timeZone={timeZone} now={now} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Current streak" value={plural(streaks.current, "day")} />
        <StatTile label="Longest streak" value={plural(streaks.longest, "day")} hint="all time" />
        <StatTile label="Active days" value={streaks.total} hint="all time" />
        <StatTile label="This month" value={thisMonth} hint={formatDay(todayDay, { month: "long" })} />
      </div>

      <section className="rounded-2xl border border-line bg-panel p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">Your year</h2>
          <nav className="flex rounded-lg border border-line bg-panel-2 p-0.5 text-sm" aria-label="Heatmap mode">
            {HEATMAP_MODES.map((m) => (
              <Link
                key={m}
                href={m === "attendance" ? "/" : `/?mode=${m}`}
                aria-current={m === mode ? "page" : undefined}
                scroll={false}
                className={`rounded-md px-3 py-1 transition-colors ${m === mode ? "bg-panel text-fg shadow" : "text-muted hover:text-fg"}`}
              >
                {MODE_LABELS[m]}
              </Link>
            ))}
          </nav>
        </div>
        <Heatmap
          data={heatmap}
          mode={mode}
          today={todayDay}
          summary={`${plural(streaks.total, "active day")} in total, current streak ${plural(streaks.current, "day")}, ${thisMonth} this month.`}
        />
        {mode !== "attendance" && activity.tasksByDay.size === 0 ? (
          <p className="mt-3 text-xs text-muted">Task counts appear here once the Tasks page lands in Phase 2.</p>
        ) : null}
      </section>
    </div>
  );
}
