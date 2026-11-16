import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, nextTheme, parseTheme, THEME_COLOR, THEME_COOKIE, themeCookie } from "./theme";

describe("parseTheme", () => {
  it("accepts the known themes", () => {
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("light")).toBe("light");
  });

  it("falls back to the default for missing or tampered values", () => {
    for (const bad of [undefined, null, "", "LIGHT", "system", "light; Path=/", "<script>"]) {
      expect(parseTheme(bad)).toBe(DEFAULT_THEME);
    }
  });

  it("keeps dark as the default so existing users see no change", () => {
    expect(DEFAULT_THEME).toBe("dark");
  });
});

describe("nextTheme", () => {
  it("flips between dark and light", () => {
    expect(nextTheme("dark")).toBe("light");
    expect(nextTheme("light")).toBe("dark");
  });
});

describe("themeCookie", () => {
  it("writes a long-lived, same-site cookie scoped to the whole app", () => {
    const cookie = themeCookie("light", false);
    expect(cookie.startsWith(`${THEME_COOKIE}=light;`)).toBe(true);
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toMatch(/Max-Age=\d{7,}/);
    expect(cookie).not.toContain("Secure");
  });

  it("adds Secure over HTTPS", () => {
    expect(themeCookie("dark", true)).toMatch(/; Secure$/);
  });
});

describe("THEME_COLOR", () => {
  it("has a browser-bar colour for every theme", () => {
    expect(THEME_COLOR.dark).toMatch(/^#[0-9a-f]{6}$/);
    expect(THEME_COLOR.light).toMatch(/^#[0-9a-f]{6}$/);
    expect(THEME_COLOR.dark).not.toBe(THEME_COLOR.light);
  });
});
