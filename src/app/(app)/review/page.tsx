import Link from "next/link";
import { BookOpen, CalendarCheck, CheckCircle2, ChevronLeft, ChevronRight, Clock, Flame, Link2, Repeat, Smile } from "lucide-react";
import { cls } from "@/components/cls";
import { CardHeader, PageHeader } from "@/components/page-ui";
import { CarryAllButton, CarryRow, PlanTaskForm, ReflectionForm } from "@/components/review/review-ui";
import { StatTile } from "@/components/stat-tile";
import { formatDay, today as getToday } from "@/lib/dates";
import { getWeekReview } from "@/lib/queries/review";
import { parseWeekParam, weekLabel, weekRange, weekStartOf } from "@/lib/review";

export const dynamic = "force-dynamic";
export const metadata = { title: "Weekly review · Logbook" };

const MOOD_WORDS = ["", "Rough", "Low", "Okay", "Good", "Great"] as const;

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const today = getToday();
  const start = parseWeekParam((await searchParams).week, today);
  const range = weekRange(start);
  const isCurrent = start === weekStartOf(today);
  const review = await getWeekReview(start, today);
  const { stats } = review;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        eyebrow={isCurrent ? "This week" : "Past week"}
        title="Weekly review"
        description={`${weekLabel(start)} — look back at what got done, decide what carries over, and set up next week.`}
        actions={
          <>
            {review.streak ? (
              <span className={`${cls.chip} h-8 px-2.5 text-[12px]`}>
                <Flame className="size-3.5 text-warn" aria-hidden /> {review.streak}-week streak
              </span>
            ) : null}
            <nav aria-label="Weeks" className={cls.segment}>
              <Link href={`/review?week=${range.prev}`} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-muted transition-colors duration-150 hover:text-fg">
                <ChevronLeft className="size-3.5" aria-hidden /> Previous
              </Link>
              {isCurrent ? (
                <span aria-disabled className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-faint/60">
                  Next <ChevronRight className="size-3.5" aria-hidden />
                </span>
              ) : (
                <Link href={range.next === weekStartOf(today) ? "/review" : `/review?week=${range.next}`} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-muted transition-colors duration-150 hover:text-fg">
                  Next <ChevronRight className="size-3.5" aria-hidden />
                </Link>
              )}
            </nav>
          </>
        }
      />

      <div className="rise grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" style={{ "--i": 1 } as React.CSSProperties}>
        <StatTile label="Tasks done" value={stats.tasksDone} icon={CheckCircle2} tone={stats.tasksDone ? "success" : "default"} />
        <StatTile label="Habit check-ins" value={stats.habitTicks} icon={Repeat} />
        <StatTile label="Days present" value={`${stats.daysPresent}/7`} icon={CalendarCheck} />
        <StatTile label="Journal" value={stats.journalDays} unit={stats.journalDays === 1 ? "day" : "days"} icon={BookOpen} hint={stats.mood ? `Mood ${stats.mood} · ${MOOD_WORDS[Math.round(stats.mood)]}` : undefined} />
        <StatTile label="Links saved" value={stats.linksSaved} icon={Link2} />
        <StatTile label="Focused" value={stats.focusedHours} unit="h" icon={Clock} hint="Time Table blocks done" />
      </div>

      <div className="rise grid gap-4 lg:grid-cols-2" style={{ "--i": 2 } as React.CSSProperties}>
        <section className={`${cls.card} p-5`}>
          <CardHeader title="What got done" count={review.done.length} />
          {review.done.length ? (
            <ul className="-mx-2 flex max-h-80 flex-col overflow-y-auto">
              {review.done.map((d) => (
                <li key={`${d.id}-${d.day}`} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm">
                  <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{d.title}</span>
                  <span className="shrink-0 text-xs text-faint">{formatDay(d.day, { weekday: "short" })}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nothing ticked off this week yet. Tasks you complete show up here.</p>
          )}
          {review.habits.length ? (
            <div className="mt-4 border-t border-line pt-4">
              <h3 className={`${cls.eyebrow} mb-2`}>Habits</h3>
              <ul className="flex flex-col gap-1.5">
                {review.habits.map((h) => (
                  <li key={h.id} className="flex items-center gap-3 text-sm">
                    <span className="min-w-0 flex-1 truncate">{h.title}</span>
                    <span className="tabular text-xs text-muted">{h.done}/7</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className={`${cls.card} p-5`}>
          <CardHeader title="Carries over" count={review.carryOver.length} action={review.carryOver.length > 1 ? <CarryAllButton start={start} count={review.carryOver.length} /> : undefined} />
          {review.carryOver.length ? (
            <>
              <p className="mb-2 text-[13px] text-muted">Still open and due by {formatDay(range.end, { weekday: "long" })}. Tick off, or push to next Monday.</p>
              <ul className="-mx-2 flex max-h-80 flex-col overflow-y-auto">
                {review.carryOver.map((t) => (
                  <CarryRow key={t.id} task={t} start={start} today={today} />
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-muted">Nothing left hanging. Every task due this week is done or rescheduled.</p>
          )}
        </section>
      </div>

      <div className="rise grid gap-4 lg:grid-cols-[1fr_1.4fr]" style={{ "--i": 3 } as React.CSSProperties}>
        <section className={`${cls.card} flex flex-col gap-3 p-5`}>
          <CardHeader title={`Next week · ${weekLabel(range.next)}`} count={review.nextWeek.length} />
          {review.nextWeek.length ? (
            <ul className="-mx-2 flex max-h-72 flex-col overflow-y-auto">
              {review.nextWeek.map((t) => (
                <li key={t.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  <span className="tabular shrink-0 text-xs text-faint">{t.dueDate ? formatDay(t.dueDate, { weekday: "short", day: "numeric" }) : ""}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nothing planned yet. Add the tasks that will move you forward.</p>
          )}
          <PlanTaskForm dueDate={range.next} />
        </section>

        <section className={`${cls.card} p-5`}>
          <CardHeader title="Reflect" action={<Smile className="size-4 text-faint" aria-hidden />} />
          <ReflectionForm key={start} start={start} reflection={review.reflection} />
        </section>
      </div>
    </div>
  );
}
