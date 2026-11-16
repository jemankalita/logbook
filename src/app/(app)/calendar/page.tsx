import { CalendarSetup } from "@/components/calendar-ui";
import { CalendarApp, type GoogleState } from "@/components/calendar/calendar-app";
import { RefreshCalendarButton } from "@/components/refresh-calendar-button";
import { getCalendarSnapshot } from "@/lib/calendar/feeds";
import { fromGoogleEvent, googleColor, googleSourceId, type CalendarSource } from "@/lib/calendar/items";
import { getLocalCalendar } from "@/lib/calendar/local";
import { parseAnchor, parseView, viewRange } from "@/lib/calendar/view";
import { appTimezone, today as todayIn } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendar · Logbook" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string }> }) {
  const params = await searchParams;
  const timeZone = appTimezone();
  const today = todayIn();
  const range = viewRange(parseView(params.view), parseAnchor(params.date, today));

  const [google, local] = await Promise.all([getCalendarSnapshot(range.first, range.days), getLocalCalendar(range.first, range.days, timeZone)]);

  const googleSources: CalendarSource[] =
    google.state === "ok"
      ? google.snapshot.calendars.map((c) => ({ id: googleSourceId(c.index), name: c.name, color: googleColor(c.index), kind: "google", ok: c.ok, error: c.error }))
      : [];
  const googleItems = google.state === "ok" ? google.snapshot.events.map(fromGoogleEvent) : [];
  const googleState: GoogleState =
    google.state === "ok" ? { state: "ok", fetchedAt: google.snapshot.fetchedAt } : google.state === "error" ? { state: "error", error: google.error } : { state: "unconfigured" };

  return (
    <CalendarApp
      {...range}
      today={today}
      timeZone={timeZone}
      nowIso={new Date().toISOString()}
      sources={[...googleSources, ...local.sources]}
      items={[...googleItems, ...local.items]}
      google={googleState}
      refresh={<RefreshCalendarButton />}
      setup={<CalendarSetup />}
    />
  );
}
