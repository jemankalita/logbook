import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createIdleRelease } from "./idle-release";

describe("createIdleRelease", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test("closes the pool after it sits idle", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const release = createIdleRelease(close, 1000);

    release.touch();
    await vi.advanceTimersByTimeAsync(999);
    expect(close).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  test("each use pushes the close back", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const release = createIdleRelease(close, 1000);

    release.touch();
    await vi.advanceTimersByTimeAsync(800);
    release.touch();
    await vi.advanceTimersByTimeAsync(800);
    expect(close).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    expect(close).toHaveBeenCalledTimes(1);
  });

  test("keep-alive promises all settle, so no request is held open forever", async () => {
    const promises: Promise<void>[] = [];
    const release = createIdleRelease(() => Promise.resolve(), 1000, (p) => promises.push(p));

    release.touch();
    release.touch();
    await vi.advanceTimersByTimeAsync(1000);
    await expect(Promise.all(promises)).resolves.toBeDefined();
    expect(promises).toHaveLength(2);
  });

  test("a failed close is logged, and the keep-alive still settles", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const promises: Promise<void>[] = [];
    const release = createIdleRelease(() => Promise.reject(new Error("boom")), 1000, (p) => promises.push(p));

    release.touch();
    await vi.advanceTimersByTimeAsync(1000);
    await expect(promises[0]).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  test("reports stale when the timer never got to run (frozen instance)", () => {
    let now = 0;
    const release = createIdleRelease(() => Promise.resolve(), 1000, () => {}, () => now);

    release.touch();
    now = 1500;
    expect(release.isStale()).toBe(false);
    now = 2001;
    expect(release.isStale()).toBe(true);
  });
});
