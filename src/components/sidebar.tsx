"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookMarked,
  CalendarClock,
  CalendarDays,
  CheckSquare,
  Compass,
  LayoutDashboard,
  LineChart,
  ListChecks,
  LogOut,
  NotebookPen,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { logout } from "@/app/(app)/actions";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** not built yet — shown as "soon", not clickable */
  soon?: boolean;
}

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/library", label: "Library", icon: BookMarked, soon: true },
  { href: "/tasks", label: "Tasks", icon: CheckSquare, soon: true },
  { href: "/timetable", label: "Time Table", icon: CalendarClock, soon: true },
  { href: "/journal", label: "Journal", icon: NotebookPen, soon: true },
  { href: "/opportunities", label: "Opportunities", icon: Trophy, soon: true },
  { href: "/paths", label: "Paths", icon: Compass, soon: true },
  { href: "/lists", label: "Lists", icon: ListChecks, soon: true },
  { href: "/insights", label: "Insights", icon: LineChart, soon: true },
];

function NavLink({ item, active, compact }: { item: NavItem; active: boolean; compact?: boolean }) {
  const Icon = item.icon;
  const base = compact
    ? "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm"
    : "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm";

  if (item.soon) {
    return (
      <span className={`${base} cursor-default text-muted/60`} aria-disabled="true" title="Coming in a later phase">
        <Icon className="size-4" aria-hidden />
        <span className="flex-1">{item.label}</span>
        {!compact && <span className="rounded bg-panel-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">soon</span>}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`${base} transition-colors ${active ? "bg-panel-2 text-fg" : "text-muted hover:bg-panel-2/60 hover:text-fg"}`}
    >
      <Icon className="size-4" aria-hidden />
      <span>{item.label}</span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      {/* Desktop */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-panel px-3 py-4 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2.5">
          <span aria-hidden className="text-lg">📓</span>
          <span className="font-semibold">Logbook</span>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5" aria-label="Main">
          {NAV.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </nav>
        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-muted transition-colors hover:bg-panel-2/60 hover:text-fg"
          >
            <LogOut className="size-4" aria-hidden />
            Lock
          </button>
        </form>
      </aside>

      {/* Mobile */}
      <header className="sticky top-0 z-10 border-b border-line bg-panel/95 backdrop-blur md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-semibold">📓 Logbook</span>
          <form action={logout}>
            <button type="submit" className="text-sm text-muted" aria-label="Lock">
              <LogOut className="size-4" aria-hidden />
            </button>
          </form>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Main">
          {NAV.filter((i) => !i.soon).map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} compact />
          ))}
        </nav>
      </header>
    </>
  );
}
