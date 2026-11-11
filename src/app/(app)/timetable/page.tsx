import Link from "next/link";
import { and, asc, gte, isNotNull, lt } from "drizzle-orm";
import { Check, Copy, Trash2 } from "lucide-react";
import { getDb } from "@/db/client";
import { timeBlocks } from "@/db/schema";
import { cls } from "@/components/cls";
import { BlockForm, EditBlockButton } from "@/components/timetable/block-form";
import { addDays, appTimezone, dayInTimezone, formatDay, isDay, today as getToday } from "@/lib/dates";
import { areaColor } from "@/lib/colors";
import { formatDuration, minutesBetween, startOfWeek, timeInZone, zonedToUtc } from "@/lib/time";
import { copyPreviousWeek, deleteBlock, toggleBlock } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Time Table · Logbook" };

type Block = typeof timeBlocks.$inferSelect;

async function weekBlocks(monday: string, tz: string): Promise<Block[]> {
  const db = await getDb();
  return db
    .select()
    .from(timeBlocks)
    .where(and(gte(timeBlocks.startsAt, zonedToUtc(monday, "00:00", tz)), lt(timeBlocks.startsAt, zonedToUtc(addDays(monday, 7), "00:00", tz))))
    .orderBy(asc(timeBlocks.startsAt));
}

async function blockAreas(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.selectDistinct({ area: timeBlocks.area }).from(timeBlocks).where(isNotNull(timeBlocks.area));
  return rows.map((r) => r.area as string).sort();
}

export default async function TimetablePage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week } = await searchParams;
  const tz = appTimezone();
  const today = getToday();
  const monday = startOfWeek(week && isDay(week) ? week : today);
  const [blocks, areas] = await Promise.all([weekBlocks(monday, tz), blockAreas()]);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const byDay = new Map(days.map((d) => [d, blocks.filter((b) => dayInTimezone(b.startsAt, tz) === d)]));

  const minutesByArea = new Map<string, { planned: number; done: number }>();
  for (const b of blocks) {
    const key = b.area ?? "other";
    const m = minutesBetween(b.startsAt, b.endsAt);
    const cur = minutesByArea.get(key) ?? { planned: 0, done: 0 };
    minutesByArea.set(key, { planned: cur.planned + m, done: cur.done + (b.done ? m : 0) });
  }
  const totalPlanned = [...minutesByArea.values()].reduce((s, v) => s + v.planned, 0);
  const totalDone = [...minutesByArea.values()].reduce((s, v) => s + v.done, 0);
  const defaultDay = days.includes(today) ? today : monday;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className={cls.h1}>Time Table</h1>
          <p className="mt-1 text-sm text-muted">
            Week of {formatDay(monday, { month: "long", day: "numeric", year: "numeric" })} · {formatDuration(totalDone)} done of {formatDuration(totalPlanned)} planned
          </p>
        </div>
        <nav className="flex flex-wrap items-center gap-2" aria-label="Weeks">
          <Link className={cls.btn} href={`/timetable?week=${addDays(monday, -7)}`}>
            ← Prev
          </Link>
          <Link className={cls.btn} href="/timetable">
            This week
          </Link>
          <Link className={cls.btn} href={`/timetable?week=${addDays(monday, 7)}`}>
            Next →
          </Link>
          <form action={copyPreviousWeek.bind(null, monday)}>
            <button type="submit" className={cls.btn} title="Repeat last week's schedule in this week">
              <Copy className="size-4" aria-hidden /> Copy last week
            </button>
          </form>
        </nav>
      </header>

      <section className={`${cls.card} p-4`}>
        <BlockForm draft={{ day: defaultDay, start: "09:00", end: "10:00" }} areas={areas} />
      </section>

      {minutesByArea.size ? (
        <ul className="flex flex-wrap gap-2 text-xs" aria-label="Hours by area">
          {[...minutesByArea.entries()]
            .sort((a, b) => b[1].planned - a[1].planned)
            .map(([area, v]) => (
              <li key={area} className="flex items-center gap-1.5 rounded-full border border-line bg-panel px-2.5 py-1">
                <span aria-hidden className="size-2 rounded-full" style={{ background: areaColor(area) }} />
                {area} · {formatDuration(v.done)}/{formatDuration(v.planned)}
              </li>
            ))}
        </ul>
      ) : null}

      <div className="grid gap-3 md:grid-cols-7">
        {days.map((d) => {
          const list = byDay.get(d) ?? [];
          return (
            <section key={d} className={`${cls.card} min-h-32 p-2 ${d === today ? "ring-1 ring-accent/60" : ""}`} aria-label={formatDay(d, { weekday: "long", month: "short", day: "numeric" })}>
              <h2 className="mb-2 flex items-baseline justify-between px-1 text-sm">
                <span className="font-medium">{formatDay(d, { weekday: "short" })}</span>
                <span className="text-xs text-muted">{formatDay(d, { month: "short", day: "numeric" })}</span>
              </h2>
              <ul className="flex flex-col gap-1.5">
                {list.map((b) => {
                  const start = timeInZone(b.startsAt, tz);
                  const end = timeInZone(b.endsAt, tz);
                  return (
                    <li key={b.id} className={`group rounded-lg border-l-4 bg-panel-2 px-2 py-1.5 text-xs ${b.done ? "opacity-60" : ""}`} style={{ borderColor: areaColor(b.area ?? "other") }}>
                      <div className="flex items-start gap-1">
                        <p className={`min-w-0 flex-1 break-words font-medium ${b.done ? "line-through" : ""}`}>{b.title}</p>
                        <EditBlockButton draft={{ id: b.id, title: b.title, area: b.area, notes: b.notes, day: d, start, end }} areas={areas} />
                      </div>
                      <p className="tabular text-muted">
                        {start}–{end}
                      </p>
                      {b.notes ? <p className="mt-0.5 line-clamp-2 text-muted">{b.notes}</p> : null}
                      <div className="mt-1 flex gap-2">
                        <form action={toggleBlock.bind(null, b.id)}>
                          <button type="submit" className="inline-flex items-center gap-1 text-muted hover:text-success" aria-pressed={b.done}>
                            <Check className="size-3" aria-hidden /> {b.done ? "Done" : "Mark done"}
                          </button>
                        </form>
                        <form action={deleteBlock.bind(null, b.id)}>
                          <button type="submit" className="text-muted hover:text-danger" aria-label={`Delete ${b.title}`}>
                            <Trash2 className="size-3" aria-hidden />
                          </button>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {list.length === 0 ? <p className="px-1 text-xs text-muted/70">Free</p> : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
