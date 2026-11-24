import {
  BookMarked,
  CalendarClock,
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  Compass,
  FileText,
  LayoutDashboard,
  LineChart,
  ListChecks,
  NotebookPen,
  Trophy,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** The sidebar, grouped by what you're doing: running the day, keeping knowledge, chasing goals. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Today",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/tasks", label: "Tasks", icon: CheckSquare },
      { href: "/timetable", label: "Time Table", icon: CalendarClock },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
    ],
  },
  {
    label: "Knowledge",
    items: [
      { href: "/library", label: "Library", icon: BookMarked },
      { href: "/notes", label: "Notes", icon: FileText },
      { href: "/journal", label: "Journal", icon: NotebookPen },
      { href: "/lists", label: "Lists", icon: ListChecks },
    ],
  },
  {
    label: "Goals",
    items: [
      { href: "/review", label: "Weekly review", icon: ClipboardCheck },
      { href: "/opportunities", label: "Opportunities", icon: Trophy },
      { href: "/paths", label: "Paths", icon: Compass },
      { href: "/insights", label: "Insights", icon: LineChart },
    ],
  },
];

/** Flat list, shared by the ⌘K palette. */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** The four destinations pinned to the phone's bottom bar. */
export const MOBILE_TABS: NavItem[] = ["/", "/tasks", "/library", "/journal"].map((href) => NAV_ITEMS.find((i) => i.href === href)!);

export function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
