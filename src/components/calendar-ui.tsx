import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { calendarColor, formatTimeRange, isHappeningNow } from "@/lib/calendar/agenda";
import type { CalendarEvent } from "@/lib/calendar/parse";
import { cls } from "./cls";
import { CardHeader } from "./page-ui";

export function EventRow({ event, timeZone, now }: { event: CalendarEvent; timeZone: string; now: Date }) {
  const live = isHappeningNow(event, now);
  const past = !event.allDay && new Date(event.end) <= now;

  return (
    <li className={`flex gap-3 rounded-lg px-2 py-2 ${live ? "bg-panel-2" : ""} ${past ? "opacity-45" : ""}`}>
      <span aria-hidden className="my-0.5 w-[3px] shrink-0 self-stretch rounded-full" style={{ background: calendarColor(event.calendarIndex) }} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <span className="break-words">{event.title}</span>
          {live ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success">
              <span className="size-1.5 rounded-full bg-success" aria-hidden />
              Now
            </span>
          ) : null}
        </p>
        <p className="tabular mt-0.5 text-xs text-muted">
          {event.allDay ? "All day" : formatTimeRange(event, timeZone)}
          <span className="sr-only">, {event.calendarName}</span>
        </p>
        {event.location ? (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-faint">
            <MapPin className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{event.location}</span>
          </p>
        ) : null}
      </div>
    </li>
  );
}

export function SyncedLabel({ fetchedAt, now }: { fetchedAt: string; now: Date }) {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(fetchedAt).getTime()) / 60_000));
  const ago = minutes < 1 ? "just now" : minutes === 1 ? "1 min ago" : minutes < 60 ? `${minutes} min ago` : `${Math.round(minutes / 60)} h ago`;
  return <span>Synced {ago} · refreshes hourly</span>;
}

const code = "rounded-[5px] border border-line bg-panel-2 px-1 py-px font-mono text-[0.85em]";

/** Shown until a Google Calendar address is configured. `compact` is the dashboard-card version. */
export function CalendarSetup({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <section className={`${cls.card} flex flex-col p-5`}>
        <CardHeader title="Schedule" />
        <span className="grid size-9 place-items-center rounded-xl border border-line bg-panel-2 text-muted shadow-raised">
          <CalendarDays className="size-4" aria-hidden />
        </span>
        <p className="mt-3 text-sm font-medium">Connect Google Calendar</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">See today&apos;s classes and events here. It takes one setting.</p>
        <Link href="/calendar" className={`${cls.btn} mt-4 self-start`}>
          How to connect
        </Link>
      </section>
    );
  }
  return (
    <div className={`${cls.card} p-6 text-sm`}>
      <h2 className="font-display text-2xl leading-tight">Connect Google Calendar</h2>
      <ol className="mt-4 list-decimal space-y-2 pl-5 leading-relaxed text-muted marker:text-faint">
        <li>
          Open <span className="text-fg">calendar.google.com → Settings</span>, pick your calendar under &ldquo;Settings for my calendars&rdquo;.
        </li>
        <li>
          Scroll to <span className="text-fg">Integrate calendar</span> and copy the <span className="text-fg">Secret address in iCal format</span>.
        </li>
        <li>
          Put it in <code className={code}>.env.local</code> (and in Vercel): <code className={`${code} break-all`}>GOOGLE_CALENDAR_ICS_URLS=https://calendar.google.com/…/basic.ics</code>. Several calendars? Separate them with commas.
        </li>
        <li>Restart the app. Events refresh every hour, or instantly with the Refresh button.</li>
      </ol>
      <p className="mt-4 border-t border-line pt-4 text-xs leading-relaxed text-faint">
        Treat that address like a password — anyone with it can read your calendar. If it leaks, use &ldquo;Reset&rdquo; next to it in Google Calendar.
      </p>
    </div>
  );
}
