"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Lock, Menu, Search, ShieldOff, X } from "lucide-react";
import { logout, signOutEverywhere } from "@/app/(app)/actions";
import { motionTokens, springs } from "@/lib/motion-tokens";
import { Wordmark } from "./brand";
import { cls } from "./cls";
import { isActivePath, MOBILE_TABS, NAV_GROUPS } from "./nav-items";
import { openPalette, SIGN_OUT_EVERYWHERE_MESSAGE } from "./sidebar";

const tab = "relative flex h-14 flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors duration-150";

/** Phone navigation: a slim top bar, a thumb-reach tab bar, and a sheet with everything else. */
export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const inTabs = MOBILE_TABS.some((t) => isActivePath(pathname, t.href));

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-bg/85 px-4 backdrop-blur-md">
        <Link href="/" aria-label="Logbook home" className="rounded-lg">
          <Wordmark />
        </Link>
        <button type="button" onClick={openPalette} aria-label="Search or capture" className="grid size-10 place-items-center rounded-lg text-muted transition-colors duration-150 hover:bg-panel-2 hover:text-fg">
          <Search className="size-5" aria-hidden />
        </button>
      </header>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-sidebar/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        {MOBILE_TABS.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`${tab} ${active ? "text-fg" : "text-faint"}`}>
              {active ? <motion.span layoutId="tab-active" transition={springs.snappy} className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-accent" /> : null}
              <Icon className={`size-5 ${active ? "text-accent" : ""}`} aria-hidden />
              {item.label}
            </Link>
          );
        })}
        <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} className={`${tab} ${!inTabs ? "text-fg" : "text-faint"}`}>
          {!inTabs ? <motion.span layoutId="tab-active" transition={springs.snappy} className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-accent" /> : null}
          <Menu className={`size-5 ${!inTabs ? "text-accent" : ""}`} aria-hidden />
          More
        </button>
      </nav>

      <AnimatePresence>
        {open ? (
          <motion.div
            key="scrim"
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: motionTokens.duration.fast }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="All sections"
              className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-xl border-t border-line bg-panel px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-pop"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={springs.gentle}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-line-strong" aria-hidden />
              <div className="mb-2 flex items-center justify-between">
                <p className="font-display text-xl">Everything</p>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid size-10 place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-fg">
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              {NAV_GROUPS.map((group) => (
                <div key={group.label} className="mb-4">
                  <p className={`${cls.eyebrow} mb-1.5 px-1`}>{group.label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {group.items.map((item) => {
                      const active = isActivePath(pathname, item.href);
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={`flex h-12 items-center gap-2.5 rounded-xl border px-3 text-sm transition-colors duration-150 ${active ? "border-line-strong bg-panel-3 text-fg" : "border-line bg-panel-2 text-muted"}`}
                        >
                          <Icon className={`size-4 ${active ? "text-accent" : "text-faint"}`} aria-hidden />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2 border-t border-line pt-4">
                <form action={logout}>
                  <button type="submit" className={`${cls.btn} h-11 w-full`}>
                    <Lock className="size-4" aria-hidden /> Lock
                  </button>
                </form>
                <form
                  action={signOutEverywhere}
                  onSubmit={(e) => {
                    if (!window.confirm(SIGN_OUT_EVERYWHERE_MESSAGE)) e.preventDefault();
                  }}
                >
                  <button type="submit" className={`${cls.btn} h-11 w-full`}>
                    <ShieldOff className="size-4" aria-hidden /> Sign out all
                  </button>
                </form>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
