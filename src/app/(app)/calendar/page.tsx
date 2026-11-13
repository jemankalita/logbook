import { CalendarSetup, EventRow, SyncedLabel } from "@/components/calendar-ui";
import { RefreshCalendarButton } from "@/components/refresh-calendar-button";
import { buildAgenda, calendarColor } from "@/lib/calendar/agenda";
import { AGENDA_DAYS, getCalendarSnapshot } from "@/lib/calendar/feeds";
import { addDays, appTimezone, formatDay, today } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendar · Logbook" };

function dayHeading(day: string, todayDay: string): string {
  if (day === todayDay) return "Today";
  if (day === addDays(todayDay, 1)) return "Tomorrow";
  return formatDay(day, { weekday: "long" });
}

export default async function CalendarPage() {
  const timeZone = appTimezone();
  const todayDay = today();
  const now = new Date();
  const result = await getCalendarSnapshot(todayDay);

  return (
    <div className="rise mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">Calendar</h1>
          <p className="mt-1 text-sm text-muted">
            {result.state === "ok" ? <SyncedLabel fetchedAt={result.snapshot.fetchedAt} now={now} /> : `Next ${AGENDA_DAYS} days from Google Calendar`}
          </p>
        </div>
        {result.state !== "unconfigured" ? <RefreshCalendarButton /> : null}
      </header>

      {result.state === "unconfigured" ? <CalendarSetup /> : null}

      {result.state === "error" ? (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm">
          Couldn&apos;t reach Google Calendar: {result.error} It will retry on your next visit.
        </p>
      ) : null}

      {result.state === "ok" ? (
        <>
          <ul className="flex flex-wrap gap-2 text-xs" aria-label="Calendars">
            {result.snapshot.calendars.map((c) => (
              <li key={c.index} className="flex items-center gap-1.5 rounded-full border border-line bg-panel px-2.5 py-1">
                <span aria-hidden className="size-2 rounded-full" style={{ background: calendarColor(c.index) }} />
                {c.name}
                {c.ok ? null : <span className="text-danger">— {c.error}</span>}
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-3">
            {buildAgenda(result.snapshot.events, todayDay, AGENDA_DAYS, timeZone).map((d) => {
              const empty = d.allDay.length === 0 && d.timed.length === 0;
              return (
                <section key={d.day} className={`rounded-xl border border-line bg-panel shadow-card p-4 ${d.day === todayDay ? "ring-1 ring-accent/50" : ""}`}>
                  <h2 className="mb-1 flex items-baseline gap-2 px-2">
                    <span className="font-medium">{dayHeading(d.day, todayDay)}</span>
                    <span className="text-xs text-muted">{formatDay(d.day, { month: "short", day: "numeric" })}</span>
                  </h2>
                  {empty ? (
                    <p className="px-2 py-1 text-sm text-muted">Nothing scheduled</p>
                  ) : (
                    <ul>
                      {[...d.allDay, ...d.timed].map((e) => (
                        <EventRow key={`${d.day}-${e.id}`} event={e} timeZone={timeZone} now={now} />
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
