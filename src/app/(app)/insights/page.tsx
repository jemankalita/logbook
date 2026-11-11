import Link from "next/link";
import { Network } from "lucide-react";
import { cls } from "@/components/cls";
import { CategoryBars, MoodLine, WeeklyBars } from "@/components/insights/charts";
import { StatTile } from "@/components/stat-tile";
import { today as getToday } from "@/lib/dates";
import { getInsights, INSIGHT_WEEKS } from "@/lib/queries/insights";

export const dynamic = "force-dynamic";
export const metadata = { title: "Insights · Logbook" };

export default async function InsightsPage() {
  const data = await getInsights(getToday());
  const t = data.totals;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className={cls.h1}>Insights</h1>
          <p className="mt-1 text-sm text-muted">The last {INSIGHT_WEEKS} weeks at a glance.</p>
        </div>
        <Link href="/insights/graph" className={cls.btnPrimary}>
          <Network className="size-4" aria-hidden /> Knowledge graph
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatTile label="Tasks done" value={t.tasksDone30} hint="last 30 days" />
        <StatTile label="Journal entries" value={t.journal30} hint="last 30 days" />
        <StatTile label="Saved links" value={t.links} hint="all time" />
        <StatTile label="Notes" value={t.notes} hint="all time" />
        <StatTile label="Open opportunities" value={t.activeOpps} hint="in the pipeline" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <WeeklyBars title="Tasks & habits completed" data={data.tasksPerWeek} unit="completed" colorIndex={2} />
        <WeeklyBars title="Days present" data={data.attendancePerWeek} unit="days" colorIndex={0} />
        <WeeklyBars title="Links saved" data={data.linksPerWeek} unit="links" colorIndex={6} />
        <MoodLine data={data.mood} />
        <CategoryBars title="Library by type" data={data.libraryByType} unit="items" empty="Save some links to see the mix." />
        <CategoryBars title="Opportunities by stage" data={data.oppsByStage} unit="items" empty="No opportunities tracked yet." />
        <CategoryBars
          title="Focused hours by area"
          subtitle="Time Table blocks marked done, last 28 days"
          data={data.hoursByArea}
          unit="hours"
          colorBy="area"
          empty="Mark Time Table blocks as done to see where your hours go."
        />
      </div>
    </div>
  );
}
