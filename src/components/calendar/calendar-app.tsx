"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { Check, ChevronLeft, ChevronRight, ExternalLink, Plus } from "lucide-react";
import { inkOn, type CalendarItem, type CalendarSource } from "@/lib/calendar/items";
import { CALENDAR_VIEWS, calendarHref, type CalendarView } from "@/lib/calendar/view";
import { addDays, type Day } from "@/lib/dates";
import { cls } from "../cls";
import { Segmented } from "../segmented";
import { EventPopover, type OpenEvent } from "./event-popover";
import { MiniMonth } from "./mini-month";
import { MonthGrid } from "./month-grid";
import { ScheduleList } from "./schedule-list";
import { TimeGrid } from "./time-grid";

export type GoogleState = { state: "unconfigured" } | { state: "ok"; fetchedAt: string } | { state: "error"; error: string };

export interface CalendarAppProps {
  view: CalendarView;
  anchor: Day;
  first: Day;
  days: number;
  prev: Day;
  next: Day;
  title: string;
  today: Day;
  timeZone: string;
  nowIso: string;
  sources: CalendarSource[];
  items: CalendarItem[];
  google: GoogleState;
  /** server-rendered bits: the refresh form and the "connect Google" instructions */
  refresh: ReactNode;
  setup: ReactNode;
}

const HIDDEN_KEY = "logbook.calendar.hidden";
const MINUTE = 60_000;

function readHidden(): string[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(HIDDEN_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeHidden(ids: string[]) {
  try {
    window.localStorage.setItem(HIDDEN_KEY, JSON.stringify(ids));
  } catch {
    // private mode: toggles still work for this visit
  }
}

function syncedAgo(fetchedAt: string, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - Date.parse(fetchedAt)) / MINUTE));
  return minutes < 1 ? "just now" : minutes < 60 ? `${minutes} min ago` : `${Math.round(minutes / 60)} h ago`;
}

export function CalendarApp(props: CalendarAppProps) {
  const { view, anchor, first, days, prev, next, title, today, timeZone, sources, items, google } = props;
  const router = useRouter();
  const [now, setNow] = useState(() => new Date(props.nowIso));
  const [hidden, setHidden] = useState<string[]>([]);
  const [open, setOpen] = useState<OpenEvent | null>(null);

  useEffect(() => setHidden(readHidden()), []);
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), MINUTE);
    return () => window.clearInterval(id);
  }, []);
  // A new range means the old popover's anchor is gone.
  useEffect(() => setOpen(null), [first, view]);

  const toggle = (id: string) =>
    setHidden((h) => {
      const nextHidden = h.includes(id) ? h.filter((x) => x !== id) : [...h, id];
      writeHidden(nextHidden);
      return nextHidden;
    });

  const colors = useMemo(() => new Map(sources.map((s) => [s.id, s.color])), [sources]);
  const colorOf = useCallback((item: CalendarItem) => colors.get(item.sourceId) ?? "#7986cb", [colors]);
  const visible = useMemo(() => items.filter((i) => !hidden.includes(i.sourceId)), [items, hidden]);
  const onOpen = useCallback((item: CalendarItem, el: HTMLElement) => setOpen({ item, anchor: el.getBoundingClientRect() }), []);
  const close = useCallback(() => setOpen(null), []);

  const viewHref = useCallback((v: CalendarView, d: Day) => calendarHref(v, d), []);
  const dayHref = useCallback((d: Day) => calendarHref("day", d), []);
  const sameViewHref = useCallback((d: Day) => calendarHref(view, d), [view]);

  // Google Calendar's keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      const key = e.key.toLowerCase();
      const go = (href: string) => {
        e.preventDefault();
        router.push(href, { scroll: false });
      };
      if (key === "t") return go(viewHref(view, today));
      if (key === "j" || key === "n") return go(viewHref(view, next));
      if (key === "k" || key === "p") return go(viewHref(view, prev));
      const match = CALENDAR_VIEWS.find((v) => v.key === key);
      if (match) go(viewHref(match.id, anchor));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, view, today, next, prev, anchor, viewHref]);

  const googleSources = sources.filter((s) => s.kind === "google");
  const localSources = sources.filter((s) => s.kind !== "google");
  const grid = { items: visible, today, timeZone, now, colorOf, onOpen, dayHref };
  const isCurrent = view === "month" ? anchor.slice(0, 7) === today.slice(0, 7) : today >= first && today <= addDays(first, days - 1);

  return (
    <div className="-mx-4 -mt-6 flex h-[calc(100dvh-9.5rem)] min-h-[34rem] flex-col md:-mx-10 md:-mb-20 md:-mt-12 md:h-dvh">
      {/* Toolbar */}
      <header className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-2 border-b border-line px-3 py-2.5 md:px-4">
        <Link href={viewHref(view, today)} aria-disabled={isCurrent} className={`${cls.btn} h-9 rounded-full px-4`} title="Today (T)">
          Today
        </Link>
        <div className="flex items-center">
          <Link href={viewHref(view, prev)} scroll={false} aria-label="Previous period" title="Previous (K)" className="grid size-9 place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-panel-2 hover:text-fg">
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <Link href={viewHref(view, next)} scroll={false} aria-label="Next period" title="Next (J)" className="grid size-9 place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-panel-2 hover:text-fg">
            <ChevronRight className="size-5" aria-hidden />
          </Link>
        </div>
        <h1 className="min-w-0 flex-1 truncate text-[1.375rem] font-normal tracking-[-0.01em] text-fg" aria-live="polite">
          {title}
        </h1>
        {google.state === "unconfigured" ? null : <div className="hidden sm:block">{props.refresh}</div>}
        <div className="max-w-full overflow-x-auto">
          <Segmented label="Calendar view" items={CALENDAR_VIEWS.map((v) => ({ href: viewHref(v.id, anchor), label: v.label, active: v.id === view }))} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r border-line px-3 py-4 lg:flex">
          <details className="group relative">
            <summary className="inline-flex h-12 items-center gap-3 rounded-2xl border border-line bg-panel pl-4 pr-6 text-sm font-medium shadow-raised transition-[background-color,box-shadow] duration-150 hover:bg-panel-2">
              <Plus className="size-5 text-accent" aria-hidden />
              Create
            </summary>
            <div className="absolute left-0 top-14 z-30 w-56 animate-pop-in rounded-xl border border-line bg-panel p-1 text-sm shadow-pop">
              {[
                { href: "/tasks?view=upcoming", label: "Task" },
                { href: "/timetable", label: "Time Table block" },
                { href: "/opportunities", label: "Opportunity deadline" },
              ].map((o) => (
                <Link key={o.href} href={o.href} className="block rounded-lg px-3 py-2 transition-colors duration-150 hover:bg-panel-2">
                  {o.label}
                </Link>
              ))}
              <a href="https://calendar.google.com/calendar/r/eventedit" target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors duration-150 hover:bg-panel-2">
                Google Calendar event
                <ExternalLink className="size-3.5 text-muted" aria-hidden />
              </a>
            </div>
          </details>

          <MiniMonth anchor={anchor} today={today} rangeFirst={first} rangeDays={days} hrefFor={sameViewHref} />

          {googleSources.length > 0 ? <SourceList title="Google Calendar" sources={googleSources} hidden={hidden} onToggle={toggle} /> : null}
          <SourceList title="Logbook" sources={localSources} hidden={hidden} onToggle={toggle} />

          <p className="mt-auto px-2 text-[11px] leading-relaxed text-faint">
            {google.state === "ok" ? `Google synced ${syncedAgo(google.fetchedAt, now)} · refreshes hourly` : null}
            {google.state === "error" ? `Google Calendar: ${google.error}` : null}
            {google.state === "unconfigured" ? "Google Calendar not connected" : null}
            <br />
            Shortcuts: <kbd className={cls.kbd}>T</kbd> today · <kbd className={cls.kbd}>J</kbd>/<kbd className={cls.kbd}>K</kbd> next/prev · <kbd className={cls.kbd}>D</kbd> <kbd className={cls.kbd}>W</kbd> <kbd className={cls.kbd}>M</kbd> <kbd className={cls.kbd}>X</kbd> <kbd className={cls.kbd}>A</kbd> views
          </p>
        </aside>

        {/* Main view */}
        <section className="flex min-w-0 flex-1 flex-col" aria-label={`${title}, ${view} view`}>
          {google.state !== "ok" ? (
            <details className="shrink-0 border-b border-line bg-panel/60 px-4 py-2 text-[13px]">
              <summary className={google.state === "error" ? "text-danger" : "text-muted"}>
                {google.state === "error" ? `Couldn't reach Google Calendar: ${google.error} Showing Logbook items only.` : "Google Calendar isn't connected yet — showing your Logbook tasks, deadlines and Time Table. "}
                <span className="font-medium text-fg underline decoration-line-strong underline-offset-4">How to connect</span>
              </summary>
              <div className="mt-3 max-w-2xl pb-2">{props.setup}</div>
            </details>
          ) : null}
          <div className="min-h-0 flex-1">
            {view === "month" ? (
              <MonthGrid {...grid} first={first} days={days} month={anchor.slice(0, 7)} />
            ) : view === "schedule" ? (
              <ScheduleList {...grid} first={first} days={days} />
            ) : (
              <TimeGrid {...grid} days={Array.from({ length: days }, (_, i) => addDays(first, i))} />
            )}
          </div>
        </section>
      </div>

      <AnimatePresence>{open ? <EventPopover key={open.item.id} open={open} source={sources.find((s) => s.id === open.item.sourceId)} timeZone={timeZone} onClose={close} /> : null}</AnimatePresence>
    </div>
  );
}

function SourceList({ title, sources, hidden, onToggle }: { title: string; sources: CalendarSource[]; hidden: string[]; onToggle: (id: string) => void }) {
  return (
    <section>
      <h2 className="mb-1 px-2 text-[13px] font-medium text-fg">{title}</h2>
      <ul>
        {sources.map((s) => {
          const on = !hidden.includes(s.id);
          return (
            <li key={s.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => onToggle(s.id)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors duration-150 hover:bg-panel-2"
              >
                <span className="grid size-[18px] shrink-0 place-items-center rounded-[4px] border-2 transition-colors duration-150" style={{ borderColor: s.color, background: on ? s.color : "transparent" }}>
                  {on ? <Check className="size-3" style={{ color: inkOn(s.color) }} strokeWidth={3.5} aria-hidden /> : null}
                </span>
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                {s.ok ? null : <span className="text-[11px] text-danger" title={s.error}>error</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
