/**
 * Colour theme. Stored in a plain (non-secret) cookie so the server renders the right theme on
 * the first byte — no flash of the wrong colours on load. Dark is the default.
 */
export const THEMES = ["dark", "light"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_COOKIE = "lb_theme";
export const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
export const DEFAULT_THEME: Theme = "dark";

/** Browser-chrome colour (address bar, PWA title bar) — matches --bg of each theme. */
export const THEME_COLOR: Record<Theme, string> = { dark: "#0b0c0e", light: "#f5f6f8" };

/** Anything that isn't a known theme (missing, tampered, old value) falls back to the default. */
export function parseTheme(value: string | null | undefined): Theme {
  return (THEMES as readonly string[]).includes(value ?? "") ? (value as Theme) : DEFAULT_THEME;
}

export function nextTheme(current: Theme): Theme {
  return current === "dark" ? "light" : "dark";
}

/** The cookie string the client writes when the theme is switched. */
export function themeCookie(theme: Theme, secure: boolean): string {
  return `${THEME_COOKIE}=${theme}; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure ? "; Secure" : ""}`;
}
