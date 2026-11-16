"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Lock, Search, ShieldOff } from "lucide-react";
import { logout, signOutEverywhere } from "@/app/(app)/actions";
import { springs } from "@/lib/motion-tokens";
import type { Theme } from "@/lib/theme";
import { Wordmark } from "./brand";
import { ThemeToggle } from "./theme-toggle";
import { cls } from "./cls";
import { OPEN_PALETTE_EVENT } from "./command-palette";
import { isActivePath, NAV_GROUPS, type NavItem } from "./nav-items";

export const SIGN_OUT_EVERYWHERE_MESSAGE = "Sign out on every device (phone, laptop, extension)? You'll need your password again here too.";

export function openPalette() {
  window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`group relative flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors duration-150 ${active ? "font-medium text-fg" : "text-muted hover:text-fg"}`}
    >
      {active ? (
        <motion.span layoutId="sidebar-active" transition={springs.snappy} className="absolute inset-0 rounded-lg border border-line bg-panel-2 shadow-card" />
      ) : (
        <span className="absolute inset-0 rounded-lg bg-panel-2/0 transition-colors duration-150 group-hover:bg-panel-2/50" />
      )}
      <Icon className={`relative size-4 shrink-0 transition-colors duration-150 ${active ? "text-accent" : "text-faint group-hover:text-muted"}`} aria-hidden />
      <span className="relative truncate">{item.label}</span>
    </Link>
  );
}

const footerBtn = "flex h-8 items-center gap-2 rounded-lg px-2.5 text-[13px] text-muted transition-colors duration-150 hover:bg-panel-2/50 hover:text-fg";

/** Desktop navigation rail. Phones get <MobileNav /> instead. */
export function Sidebar({ theme }: { theme: Theme }) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-sidebar md:flex">
      <div className="px-4 pb-3 pt-4">
        <Link href="/" className="inline-flex rounded-lg" aria-label="Logbook home">
          <Wordmark />
        </Link>
      </div>

      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={openPalette}
          className="flex h-9 w-full items-center gap-2 rounded-lg border border-line bg-panel px-2.5 text-[13px] text-muted shadow-card transition-[border-color,color] duration-150 hover:border-line-strong hover:text-fg"
        >
          <Search className="size-4 text-faint" aria-hidden />
          <span className="flex-1 text-left">Search or capture</span>
          <span className="flex gap-0.5" aria-hidden>
            <kbd className={cls.kbd}>Ctrl</kbd>
            <kbd className={cls.kbd}>K</kbd>
          </span>
        </button>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-2" aria-label="Main">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className={`${cls.eyebrow} mb-1.5 px-2.5`}>{group.label}</p>
            <div className="flex flex-col gap-px">
              {group.items.map((item) => (
                <NavLink key={item.href} item={item} active={isActivePath(pathname, item.href)} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="flex items-center justify-between gap-1 border-t border-line p-3">
        <form action={logout} className="min-w-0 flex-1">
          <button type="submit" className={`${footerBtn} w-full`}>
            <Lock className="size-4 text-faint" aria-hidden />
            Lock this device
          </button>
        </form>
        <ThemeToggle initial={theme} className={`${footerBtn} w-8 justify-center px-0`} />
        <form
          action={signOutEverywhere}
          onSubmit={(e) => {
            if (!window.confirm(SIGN_OUT_EVERYWHERE_MESSAGE)) e.preventDefault();
          }}
        >
          <button type="submit" className={`${footerBtn} w-8 justify-center px-0`} aria-label="Sign out everywhere" title="Sign out everywhere">
            <ShieldOff className="size-4 text-faint" aria-hidden />
          </button>
        </form>
      </div>
    </aside>
  );
}
