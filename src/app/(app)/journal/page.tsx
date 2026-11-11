import Link from "next/link";
import { desc, eq, gte } from "drizzle-orm";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getDb } from "@/db/client";
import { journal } from "@/db/schema";
import { cls } from "@/components/cls";
import { DocEditor } from "@/components/editor/doc-editor";
import { addDays, diffDays, formatDay, isDay, today as getToday } from "@/lib/dates";
import { excerpt, isDoc } from "@/lib/rich-text";
import { saveJournal, setMood } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Journal · Logbook" };

const MOODS = [
  { value: 1, emoji: "😞", label: "Rough" },
  { value: 2, emoji: "😕", label: "Meh" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😄", label: "Great" },
];
const STRIP_DAYS = 35;

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const today = getToday();
  const requested = (await searchParams).day;
  const day = requested && isDay(requested) && diffDays(requested, today) <= 0 ? requested : today;
  const db = await getDb();
  const [[entry], recent, strip] = await Promise.all([
    db.select().from(journal).where(eq(journal.day, day)).limit(1),
    db.select({ day: journal.day, bodyText: journal.bodyText, mood: journal.mood }).from(journal).orderBy(desc(journal.day)).limit(12),
    db.select({ day: journal.day, bodyText: journal.bodyText, mood: journal.mood }).from(journal).where(gte(journal.day, addDays(today, -(STRIP_DAYS - 1)))),
  ]);
  const written = new Map(strip.map((s) => [s.day, s]));
  const next = addDays(day, 1);

  return (
    <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_260px]">
      <div className="flex min-w-0 flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted">{day === today ? "Today" : `${diffDays(today, day)} days ago`}</p>
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
                className={`grid size-9 place-items-center rounded-lg text-xl transition ${entry?.mood === m.value ? "bg-panel-2 ring-1 ring-accent" : "opacity-50 grayscale hover:opacity-100 hover:grayscale-0"}`}
              >
                {m.emoji}
              </button>
            </form>
          ))}
        </div>

        <div className="pt-6">
          <DocEditor
            key={day}
            initial={isDoc(entry?.body) ? entry.body : null}
            save={saveJournal.bind(null, day)}
            label={`Journal for ${day}`}
            placeholder="What happened today? What did you learn? What's on your mind?"
          />
        </div>
      </div>

      <aside className="flex flex-col gap-5">
        <section>
          <h2 className="mb-2 text-sm font-medium text-muted">Last 5 weeks</h2>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: STRIP_DAYS }, (_, i) => addDays(today, i - STRIP_DAYS + 1)).map((d) => {
              const w = written.get(d);
              const has = Boolean(w?.bodyText);
              return (
                <Link
                  key={d}
                  href={`/journal?day=${d}`}
                  title={`${formatDay(d)}${has ? " — written" : ""}`}
                  aria-label={`${formatDay(d)}${has ? ", written" : ""}`}
                  aria-current={d === day ? "date" : undefined}
                  className={`grid aspect-square place-items-center rounded text-[10px] ${has ? "bg-success/70 text-black" : "bg-panel-2 text-muted"} ${d === day ? "ring-2 ring-accent" : ""}`}
                >
                  {Number(d.slice(8))}
                </Link>
              );
            })}
          </div>
        </section>
        <section>
          <h2 className="mb-2 text-sm font-medium text-muted">Recent entries</h2>
          <ul className="flex flex-col gap-1">
            {recent
              .filter((r) => r.bodyText)
              .map((r) => (
                <li key={r.day}>
                  <Link href={`/journal?day=${r.day}`} className="block rounded-lg px-2 py-1.5 hover:bg-panel-2">
                    <p className="text-sm">
                      {formatDay(r.day, { month: "short", day: "numeric" })} {r.mood ? MOODS[r.mood - 1]?.emoji : ""}
                    </p>
                    <p className="line-clamp-2 text-xs text-muted">{excerpt(r.bodyText, 100)}</p>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}
