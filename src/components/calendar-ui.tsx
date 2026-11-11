import { MapPin } from "lucide-react";
import { calendarColor, formatTimeRange, isHappeningNow } from "@/lib/calendar/agenda";
import type { CalendarEvent } from "@/lib/calendar/parse";

export function EventRow({ event, timeZone, now }: { event: CalendarEvent; timeZone: string; now: Date }) {
  const live = isHappeningNow(event, now);
  const past = !event.allDay && new Date(event.end) <= now;

  return (
    <li className={`flex gap-3 rounded-lg px-2 py-2 ${live ? "bg-panel-2" : ""} ${past ? "opacity-50" : ""}`}>
      <span aria-hidden className="mt-1 w-1 shrink-0 self-stretch rounded-full" style={{ background: calendarColor(event.calendarIndex) }} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          <span className="break-words">{event.title}</span>
          {live ? <span className="rounded bg-success px-1.5 py-0.5 text-[10px] font-semibold uppercase text-black">Now</span> : null}
        </p>
        <p className="tabular text-sm text-muted">
          {event.allDay ? "All day" : formatTimeRange(event, timeZone)}
          <span className="sr-only">, {event.calendarName}</span>
        </p>
        {event.location ? (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
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

export function CalendarSetup() {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-panel p-5 text-sm">
      <h2 className="font-medium">Connect Google Calendar</h2>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-muted">
        <li>
          Open <span className="text-fg">calendar.google.com → ⚙ Settings</span>, pick your calendar under &ldquo;Settings for my calendars&rdquo;.
        </li>
        <li>
          Scroll to <span className="text-fg">Integrate calendar</span> and copy the <span className="text-fg">Secret address in iCal format</span>.
        </li>
        <li>
          Put it in <code className="rounded bg-panel-2 px-1">.env.local</code> (and in Vercel):{" "}
          <code className="break-all rounded bg-panel-2 px-1">GOOGLE_CALENDAR_ICS_URLS=https://calendar.google.com/…/basic.ics</code>. Several calendars? Separate them with commas.
        </li>
        <li>Restart the app. Events refresh every hour, or instantly with the Refresh button.</li>
      </ol>
      <p className="mt-3 text-xs text-muted">
        Treat that address like a password — anyone with it can read your calendar. If it leaks, use &ldquo;Reset&rdquo; next to it in Google Calendar.
      </p>
    </div>
  );
}
