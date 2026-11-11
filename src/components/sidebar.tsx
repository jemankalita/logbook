"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Search, ShieldOff } from "lucide-react";
import { logout, signOutEverywhere } from "@/app/(app)/actions";
import { OPEN_PALETTE_EVENT } from "./command-palette";
import { NAV_ITEMS, type NavItem } from "./nav-items";

function NavLink({ item, active, compact }: { item: NavItem; active: boolean; compact?: boolean }) {
  const Icon = item.icon;
  const base = compact
    ? "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm"
    : "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm";
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

function openPalette() {
  window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));
}

const footerBtn = "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-muted transition-colors hover:bg-panel-2/60 hover:text-fg";

export function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <>
      {/* Desktop */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-panel px-3 py-4 md:flex">
        <div className="mb-4 flex items-center gap-2 px-2.5">
          <span aria-hidden className="text-lg">
            📓
          </span>
          <span className="font-semibold">Logbook</span>
        </div>
        <button
          type="button"
          onClick={openPalette}
          className="mb-4 flex h-9 items-center gap-2 rounded-lg border border-line bg-panel-2 px-2.5 text-sm text-muted transition hover:text-fg"
        >
          <Search className="size-4" aria-hidden />
          <span className="flex-1 text-left">Search or capture</span>
          <kbd className="rounded border border-line px-1 text-[10px]">Ctrl K</kbd>
        </button>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </nav>
        <form action={logout}>
          <button type="submit" className={footerBtn}>
            <LogOut className="size-4" aria-hidden />
            Lock this device
          </button>
        </form>
        <form
          action={signOutEverywhere}
          onSubmit={(e) => {
            if (!window.confirm("Sign out on every device (phone, laptop, extension)? You'll need your password again here too.")) e.preventDefault();
          }}
        >
          <button type="submit" className={footerBtn}>
            <ShieldOff className="size-4" aria-hidden />
            Sign out everywhere
          </button>
        </form>
      </aside>

      {/* Mobile */}
      <header className="sticky top-0 z-10 border-b border-line bg-panel/95 backdrop-blur md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-semibold">📓 Logbook</span>
          <div className="flex items-center gap-4">
            <button type="button" onClick={openPalette} className="text-muted" aria-label="Search or capture">
              <Search className="size-5" aria-hidden />
            </button>
            <form action={logout}>
              <button type="submit" className="text-muted" aria-label="Lock">
                <LogOut className="size-5" aria-hidden />
              </button>
            </form>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} compact />
          ))}
        </nav>
      </header>
    </>
  );
}
