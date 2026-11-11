import {
  BookMarked,
  CalendarClock,
  CalendarDays,
  CheckSquare,
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

/** Shared by the sidebar and the ⌘K palette. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/library", label: "Library", icon: BookMarked },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/timetable", label: "Time Table", icon: CalendarClock },
  { href: "/notes", label: "Notes", icon: FileText },
  { href: "/journal", label: "Journal", icon: NotebookPen },
  { href: "/opportunities", label: "Opportunities", icon: Trophy },
  { href: "/paths", label: "Paths", icon: Compass },
  { href: "/lists", label: "Lists", icon: ListChecks },
  { href: "/insights", label: "Insights", icon: LineChart },
];
