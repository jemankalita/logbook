import Link from "next/link";
import { desc, eq, gte } from "drizzle-orm";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getDb } from "@/db/client";
import { journal } from "@/db/schema";
import { cls } from "@/components/cls";
import { DocEditor } from "@/components/editor/doc-editor";
import { addDays, diffDays, formatDay, isDay, today as getToday } from "@/lib/dates";
import { excerpt, isDoc } from "@/lib/rich-text";
import { weekGrid } from "@/lib/time";
import { CardHeader } from "@/components/page-ui";
import { saveJournal, setMood } from "./actions";
import { Emoji } from "@/components/emoji";

export const dynamic = "force-dynamic";
export const metadata = { title: "Journal · Logbook" };

const MOODS = [
  { value: 1, emoji: "😞", label: "Rough" },
  { value: 2, emoji: "😕", label: "Meh" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😄", label: "Great" },
];
const GRID_WEEKS = 5;
const WEEKDAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"];

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const today = getToday();
  const requested = (await searchParams).day;
  const day = requested && isDay(requested) && diffDays(requested, today) <= 0 ? requested : today;
  const grid = weekGrid(today, GRID_WEEKS);
  const db = await getDb();
  const [[entry], recent, strip] = await Promise.all([
    db.select().from(journal).where(eq(journal.day, day)).limit(1),
    db.select({ day: journal.day, bodyText: journal.bodyText, mood: journal.mood }).from(journal).orderBy(desc(journal.day)).limit(12),
    db.select({ day: journal.day, bodyText: journal.bodyText, mood: journal.mood }).from(journal).where(gte(journal.day, grid[0])),
  ]);
  const written = new Map(strip.map((s) => [s.day, s]));
  const next = addDays(day, 1);

  return (
    <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_280px]">
      <div className="flex min-w-0 flex-col gap-4">
        <header className="rise flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div>
            <p className={`${cls.eyebrow} mb-2`}>{day === today ? "Today" : diffDays(today, day) === 1 ? "Yesterday" : `${diffDays(today, day)} days ago`}</p>
            <h1 className={cls.h1}>{formatDay(day, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</h1>
          </div>
          <nav className="flex gap-1" aria-label="Days">
            <Link href={`/journal?day=${addDays(day, -1)}`} className={cls.btn} aria-label="Previous day">
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
            {day !== today ? (
              <Link href="/journal" className={cls.btn}>
                Today
              </Link>
            ) : null}
            {diffDays(next, today) <= 0 ? (
              <Link href={`/journal?day=${next}`} className={cls.btn} aria-label="Next day">
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            ) : null}
          </nav>
        </header>

        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Mood">
          <span className="mr-2 text-sm text-muted">Mood</span>
          {MOODS.map((m) => (
            <form key={m.value} action={setMood.bind(null, day, m.value)}>
              <button
                type="submit"
                title={m.label}
                aria-label={m.label}
                aria-pressed={entry?.mood === m.value}
                className={`grid size-10 place-items-center rounded-lg text-xl transition-[opacity,filter,background-color] duration-150 ${entry?.mood === m.value ? "bg-panel-2 ring-1 ring-accent" : "opacity-50 grayscale hover:opacity-100 hover:grayscale-0"}`}
              >
                <Emoji char={m.emoji} size="1.5rem" />
              </button>
            </form>
          ))}
        </div>

        <div className="pt-2">
          <DocEditor
            key={day}
            initial={isDoc(entry?.body) ? entry.body : null}
            save={saveJournal.bind(null, day)}
            label={`Journal for ${day}`}
            placeholder="What happened today? What did you learn? What's on your mind?"
          />
        </div>
      </div>

      <aside className="flex flex-col gap-4 lg:pt-2">
        <section className={`${cls.card} p-4`}>
          <CardHeader title={`Last ${GRID_WEEKS} weeks`} action={<span className="tabular text-xs text-faint">{grid.filter((d) => written.get(d)?.bodyText).length} written</span>} />
          <div className="grid grid-cols-7 gap-1" role="presentation">
            {WEEKDAY_INITIALS.map((w, i) => (
              <span key={i} aria-hidden className="pb-1 text-center text-[10px] font-medium text-faint">
                {w}
              </span>
            ))}
            {grid.map((d) => {
              const has = Boolean(written.get(d)?.bodyText);
              const label = `${formatDay(d)}${has ? ", written" : ""}`;
              const tone = has ? "bg-success/15 font-medium text-success" : "bg-panel-2 text-muted";
              const current = d === day ? "ring-2 ring-accent ring-offset-1 ring-offset-panel" : "";
              if (diffDays(d, today) > 0) {
                return (
                  <span key={d} aria-hidden className="tabular grid aspect-square place-items-center rounded-md border border-dashed border-line text-[11px] text-faint">
                    {Number(d.slice(8))}
                  </span>
                );
              }
              return (
                <Link
                  key={d}
                  href={`/journal?day=${d}`}
                  title={label}
                  aria-label={label}
                  aria-current={d === day ? "date" : undefined}
                  className={`tabular grid aspect-square place-items-center rounded-md text-[11px] transition-[background-color,color] duration-150 hover:bg-panel-3 ${tone} ${current}`}
                >
                  {Number(d.slice(8))}
                </Link>
              );
            })}
          </div>
        </section>
        <section className={`${cls.card} p-4`}>
          <CardHeader title="Recent entries" />
          {recent.some((r) => r.bodyText) ? (
            <ul className="-mx-2 flex flex-col">
              {recent
                .filter((r) => r.bodyText)
                .map((r) => (
                  <li key={r.day}>
                    <Link href={`/journal?day=${r.day}`} className="block rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-panel-2">
                      <p className="flex items-center gap-1.5 text-sm">
                        {formatDay(r.day, { weekday: "short", month: "short", day: "numeric" })}
                        {r.mood ? (
                          <span className="text-xs" title={MOODS[r.mood - 1]?.label}>
                            <Emoji char={MOODS[r.mood - 1]?.emoji ?? ""} size="0.95rem" />
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted">{excerpt(r.bodyText, 100)}</p>
                    </Link>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Entries you write show up here.</p>
          )}
        </section>
      </aside>
    </div>
  );
}
