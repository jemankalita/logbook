"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { nextTheme, parseTheme, THEME_COLOR, themeCookie, type Theme } from "@/lib/theme";

/** Swap the theme in place: attribute for CSS, cookie for the next server render, meta for the browser bar. */
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  // Suppress per-element colour transitions so the whole page flips in one frame.
  root.classList.add("theme-switching");
  root.dataset.theme = theme;
  document.cookie = themeCookie(theme, window.location.protocol === "https:");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
  document.querySelector('meta[name="color-scheme"]')?.setAttribute("content", theme);
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("theme-switching")));
}

/**
 * The live theme is whatever <html data-theme> says, so every toggle on the page (sidebar, phone
 * sheet) stays in sync — even one that mounts after a switch, when the server prop is stale.
 */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

export function ThemeToggle({ initial, className, withLabel = false }: { initial: Theme; className: string; withLabel?: boolean }) {
  const theme = useSyncExternalStore(
    subscribe,
    () => parseTheme(document.documentElement.dataset.theme),
    () => initial,
  );
  const target = nextTheme(theme);
  const label = `Switch to ${target} theme`;
  const Icon = target === "light" ? Sun : Moon;

  return (
    <button type="button" onClick={() => applyTheme(target)} className={className} aria-label={withLabel ? undefined : label} title={label}>
      <Icon className="size-4 text-faint" aria-hidden />
      {withLabel ? (target === "light" ? "Light theme" : "Dark theme") : null}
    </button>
  );
}
