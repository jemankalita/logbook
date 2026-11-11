import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isPasswordConfigured, verifyPassword } from "./password";
import { GLOBAL_RULE, isOverLimit, PER_IP_RULE } from "./rate-limit";
import { createSessionToken, isValidSessionToken, safeNextPath } from "./session";

const SECRET_A = "test-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SECRET_B = "test-secret-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("verifyPassword", () => {
  it("accepts only the exact password", () => {
    expect(verifyPassword("correct-horse-battery", "correct-horse-battery")).toBe(true);
    expect(verifyPassword("correct-horse-batter", "correct-horse-battery")).toBe(false);
    expect(verifyPassword("", "correct-horse-battery")).toBe(false);
  });

  it("refuses everything when the password is missing or too short", () => {
    expect(verifyPassword("anything", undefined)).toBe(false);
    expect(verifyPassword("short-pass", "short-pass")).toBe(false);
    expect(isPasswordConfigured("short-pass")).toBe(false);
    expect(isPasswordConfigured("twelve-chars")).toBe(true);
  });
});

describe("session tokens", () => {
  const original = process.env.SESSION_SECRET;
  beforeEach(() => {
    process.env.SESSION_SECRET = SECRET_A;
  });
  afterEach(() => {
    process.env.SESSION_SECRET = original;
  });

  it("round-trips a valid token", async () => {
    expect(await isValidSessionToken(await createSessionToken())).toBe(true);
  });

  it("rejects missing, garbage, and tampered tokens", async () => {
    const token = await createSessionToken();
    expect(await isValidSessionToken(undefined)).toBe(false);
    expect(await isValidSessionToken("not-a-jwt")).toBe(false);
    expect(await isValidSessionToken(`${token.slice(0, -2)}xx`)).toBe(false);
  });

  it("rejects tokens signed with a different secret", async () => {
    const token = await createSessionToken();
    process.env.SESSION_SECRET = SECRET_B;
    expect(await isValidSessionToken(token)).toBe(false);
  });

  it("treats a missing or weak secret as signed out instead of crashing", async () => {
    process.env.SESSION_SECRET = "";
    expect(await isValidSessionToken("anything")).toBe(false);
    process.env.SESSION_SECRET = "only-32-characters-long-secret!!";
    await expect(createSessionToken()).rejects.toThrow(/at least 43/);
  });
});

describe("safeNextPath", () => {
  it("keeps same-site paths and their query", () => {
    expect(safeNextPath("/library?folder=ai")).toBe("/library?folder=ai");
    expect(safeNextPath("/calendar")).toBe("/calendar");
  });

  it("blocks open redirects, control-character tricks, and loops", () => {
    const bad = ["https://evil.com", "//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "/login", "/login?next=/", "", null, undefined];
    for (const value of bad) expect(safeNextPath(value)).toBe("/");
  });
});

describe("login throttle rules", () => {
  const start = new Date("2026-11-11T10:00:00Z");
  const at = (ms: number) => new Date(start.getTime() + ms);

  it("blocks an IP once it hits the limit inside the window", () => {
    const entry = { count: PER_IP_RULE.maxFailures, windowStart: start };
    expect(isOverLimit(entry, at(60_000), PER_IP_RULE)).toBe(true);
    expect(isOverLimit({ ...entry, count: PER_IP_RULE.maxFailures - 1 }, at(60_000), PER_IP_RULE)).toBe(false);
  });

  it("unblocks when the window expires", () => {
    const entry = { count: 99, windowStart: start };
    expect(isOverLimit(entry, at(PER_IP_RULE.windowMs), PER_IP_RULE)).toBe(false);
  });

  it("has a global cap above the per-IP cap", () => {
    expect(GLOBAL_RULE.maxFailures).toBeGreaterThan(PER_IP_RULE.maxFailures);
    expect(isOverLimit(undefined, start, GLOBAL_RULE)).toBe(false);
  });
});
