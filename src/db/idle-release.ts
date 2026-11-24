/**
 * Closes a connection pool once it has gone unused for `idleMs`.
 *
 * Why: on Vercel (Fluid compute) an instance is frozen between requests with its sockets still
 * open. The pooler drops them meanwhile, so the next query can sit on a dead socket until the
 * function times out, and connections that are never closed eat into Supabase's client cap.
 * Each `touch()` (re)arms a timer and hands `keepAlive` a promise that settles when the timer is
 * replaced or the pool is closed, so the instance stays up just long enough to close cleanly.
 */
export interface IdleRelease {
  /** Call whenever the pool is used. */
  touch(): void;
  /** True when the pool sat unused longer than allowed (the timer never ran, e.g. a frozen instance). */
  isStale(now?: number): boolean;
}

export function createIdleRelease(
  close: () => Promise<void>,
  idleMs: number,
  keepAlive: (p: Promise<void>) => void = () => {},
  clock: () => number = Date.now,
): IdleRelease {
  let lastUsed = clock();
  let pending: { timer: ReturnType<typeof setTimeout>; settle: () => void } | null = null;

  return {
    touch() {
      lastUsed = clock();
      if (pending) {
        clearTimeout(pending.timer);
        pending.settle();
      }
      let settle!: () => void;
      const done = new Promise<void>((resolve) => (settle = resolve));
      const timer = setTimeout(() => {
        pending = null;
        close()
          .catch((err: unknown) => console.error("[db] closing idle pool failed", err))
          .finally(settle);
      }, idleMs);
      pending = { timer, settle };
      keepAlive(done);
    },
    isStale(now = clock()) {
      return now - lastUsed > idleMs * 2;
    },
  };
}
