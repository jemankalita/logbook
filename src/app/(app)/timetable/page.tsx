import Link from "next/link";
import { and, asc, gte, isNotNull, lt } from "drizzle-orm";
import { Check, ChevronLeft, ChevronRight, Copy, Trash2 } from "lucide-react";
import { getDb } from "@/db/client";
import { timeBlocks } from "@/db/schema";
import { cls } from "@/components/cls";
import { PageHeader } from "@/components/page-ui";
import { BlockForm, EditBlockButton } from "@/components/timetable/block-form";
import { addDays, appTimezone, dayInTimezone, formatDay, isDay, today as getToday } from "@/lib/dates";
import { areaColor } from "@/lib/colors";
import { formatDuration, minutesBetween, startOfWeek, timeInZone, zonedToUtc } from "@/lib/time";
import { copyPreviousWeek, deleteBlock, toggleBlock } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Time Table · Logbook" };

type Block = typeof timeBlocks.$inferSelect;

const weekStep = "grid h-8 place-items-center rounded-md px-2 transition-colors duration-150 hover:bg-panel-2 hover:text-fg";
const iconBtn = "grid size-7 place-items-center rounded-md text-faint transition-colors duration-150 hover:bg-panel-3";

function BlockCard({ block, day, tz, areas }: { block: Block; day: string; tz: string; areas: string[] }) {
  const start = timeInZone(block.startsAt, tz);
  const end = timeInZone(block.endsAt, tz);
  return (
    <li className={`group/block relative flex items-start gap-2.5 overflow-hidden rounded-lg border border-line bg-panel-2/60 py-2 pl-3 pr-1.5 transition-[border-color,opacity] duration-150 hover:border-line-strong ${block.done ? "opacity-60" : ""}`}>
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ background: areaColor(block.area ?? "other") }} />
      <form action={toggleBlock.bind(null, block.id)} className="pt-0.5">
        <button
          type="submit"
          aria-pressed={block.done}
          aria-label={`Done: ${block.title}`}
          title={block.done ? "Mark not done" : "Mark done"}
          className={`relative grid size-[18px] place-items-center rounded-full border transition-colors duration-150 after:absolute after:-inset-1.5 ${block.done ? "border-success bg-success text-bg" : "border-line-strong text-transparent hover:border-success hover:text-success"}`}
        >
          <Check className="size-3" strokeWidth={3} aria-hidden />
        </button>
      </form>
      <div className="min-w-0 flex-1">
        <p className={`break-words text-[13px] font-medium leading-snug ${block.done ? "line-through decoration-faint" : ""}`}>{block.title}</p>
        <p className="tabular mt-0.5 text-xs text-muted">
          {start}–{end}
        </p>
        {block.area ? <p className="truncate text-xs text-faint">{block.area}</p> : null}
        {block.notes ? <p className="mt-1 line-clamp-2 text-xs text-muted">{block.notes}</p> : null}
      </div>
      <div className="flex shrink-0 gap-0.5 transition-opacity duration-150 xl:absolute xl:right-1 xl:top-1 xl:rounded-md xl:bg-panel-2 xl:[@media(hover:hover)]:opacity-0 xl:group-focus-within/block:opacity-100 xl:group-hover/block:opacity-100">
        <EditBlockButton draft={{ id: block.id, title: block.title, area: block.area, notes: block.notes, day, start, end }} areas={areas} className={`${iconBtn} hover:text-fg`} />
        <form action={deleteBlock.bind(null, block.id)}>
          <button type="submit" className={`${iconBtn} hover:text-danger`} aria-label={`Delete ${block.title}`} title="Delete">
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        </form>
      </div>
    </li>
  );
}

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
    <div className="rise mx-auto flex max-w-7xl flex-col gap-5">
      <PageHeader
        eyebrow={`Week of ${formatDay(monday, { month: "long", day: "numeric", year: "numeric" })}`}
        title="Time Table"
        description={
          <span className="tabular">
            <span className="text-fg">{formatDuration(totalDone)}</span> done of {formatDuration(totalPlanned)} planned
          </span>
        }
        actions={
          <nav className="flex flex-wrap items-center gap-2" aria-label="Weeks">
            <div className={cls.segment}>
              <Link className={`${weekStep} text-muted`} href={`/timetable?week=${addDays(monday, -7)}`} aria-label="Previous week" title="Previous week">
                <ChevronLeft className="size-4" aria-hidden />
              </Link>
              <Link className={`${weekStep} px-3 ${monday === startOfWeek(today) ? "bg-panel-2 font-medium text-fg" : "text-muted"}`} href="/timetable" aria-current={monday === startOfWeek(today) ? "date" : undefined}>
                This week
              </Link>
              <Link className={`${weekStep} text-muted`} href={`/timetable?week=${addDays(monday, 7)}`} aria-label="Next week" title="Next week">
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            </div>
            <form action={copyPreviousWeek.bind(null, monday)}>
              <button type="submit" className={cls.btn} title="Repeat last week's schedule in this week">
                <Copy className="size-4" aria-hidden /> Copy last week
              </button>
            </form>
          </nav>
        }
      />

      <section className={`${cls.card} p-4`}>
        <BlockForm draft={{ day: defaultDay, start: "09:00", end: "10:00" }} areas={areas} />
      </section>

      {minutesByArea.size ? (
        <ul className="flex flex-wrap gap-2 text-xs" aria-label="Hours by area">
          {[...minutesByArea.entries()]
            .sort((a, b) => b[1].planned - a[1].planned)
            .map(([area, v]) => (
              <li key={area} className="tabular flex items-center gap-1.5 rounded-md border border-line bg-panel px-2 py-1 text-muted">
                <span aria-hidden className="size-2 rounded-full" style={{ background: areaColor(area) }} />
                <span className="text-fg">{area}</span> {formatDuration(v.done)}/{formatDuration(v.planned)}
              </li>
            ))}
        </ul>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {days.map((d) => {
          const list = byDay.get(d) ?? [];
          const isToday = d === today;
          return (
            <section key={d} className={`${cls.card} flex flex-col p-2 xl:min-h-44 ${isToday ? "ring-1 ring-accent/60" : ""}`} aria-label={formatDay(d, { weekday: "long", month: "short", day: "numeric" })}>
              <h2 className="mb-2 flex h-7 items-center justify-between px-1.5 text-sm">
                <span className="font-medium">{formatDay(d, { weekday: "short" })}</span>
                <span className={`tabular rounded-md px-1.5 py-0.5 text-xs ${isToday ? "bg-accent/15 font-medium text-accent" : "text-faint"}`}>{formatDay(d, { month: "short", day: "numeric" })}</span>
              </h2>
              {list.length ? (
                <ul className="flex flex-col gap-1.5">
                  {list.map((b) => (
                    <BlockCard key={b.id} block={b} day={d} tz={tz} areas={areas} />
                  ))}
                </ul>
              ) : (
                <p className="px-1.5 pb-1 text-xs text-faint">Free</p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
