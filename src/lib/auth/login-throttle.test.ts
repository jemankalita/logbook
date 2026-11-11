import { cp, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GLOBAL_RULE, PER_IP_RULE } from "./rate-limit";

/** Integration test: real SQL against a throwaway PGlite database in a temp dir. */
const originalCwd = process.cwd();
let throttle: typeof import("./login-throttle");

beforeAll(async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "logbook-throttle-"));
  await cp(path.join(originalCwd, "drizzle"), path.join(dir, "drizzle"), { recursive: true });
  delete process.env.DATABASE_URL;
  process.chdir(dir);
  throttle = await import("./login-throttle");
  await throttle.isLoginBlocked("warm-up"); // pay PGlite's cold start + migrations here, not in a test
}, 120_000);

afterAll(() => {
  process.chdir(originalCwd);
});

describe("login throttle (database)", () => {
  const t0 = new Date("2026-11-11T10:00:00Z");
  const later = (ms: number) => new Date(t0.getTime() + ms);

  it("blocks an IP after 5 failures and unblocks after the window", async () => {
    for (let i = 0; i < PER_IP_RULE.maxFailures - 1; i++) await throttle.recordLoginFailure("1.1.1.1", t0);
    expect(await throttle.isLoginBlocked("1.1.1.1", later(1000))).toBe(false);

    await throttle.recordLoginFailure("1.1.1.1", t0);
    expect(await throttle.isLoginBlocked("1.1.1.1", later(1000))).toBe(true);
    expect(await throttle.isLoginBlocked("2.2.2.2", later(1000))).toBe(false);
    expect(await throttle.isLoginBlocked("1.1.1.1", later(PER_IP_RULE.windowMs))).toBe(false);
  });

  it("starts a fresh window after expiry instead of accumulating forever", async () => {
    const fresh = later(PER_IP_RULE.windowMs + 1);
    await throttle.recordLoginFailure("1.1.1.1", fresh);
    expect(await throttle.isLoginBlocked("1.1.1.1", fresh)).toBe(false);
  });

  it("clears an IP's counter after a successful login", async () => {
    for (let i = 0; i < PER_IP_RULE.maxFailures; i++) await throttle.recordLoginFailure("3.3.3.3", t0);
    await throttle.clearLoginFailures("3.3.3.3");
    expect(await throttle.isLoginBlocked("3.3.3.3", later(1000))).toBe(false);
  });

  it("blocks everyone once the global cap is hit (rotating IPs doesn't help)", async () => {
    const t1 = later(GLOBAL_RULE.windowMs * 2); // new global window
    for (let i = 0; i < GLOBAL_RULE.maxFailures; i++) await throttle.recordLoginFailure(`10.0.0.${i}`, t1);
    expect(await throttle.isLoginBlocked("99.99.99.99", t1)).toBe(true);
  });
});
