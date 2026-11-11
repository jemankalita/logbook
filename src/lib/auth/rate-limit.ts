/** Pure fixed-window rules for login throttling (storage lives in login-throttle.ts). */

export interface AttemptWindow {
  count: number;
  windowStart: Date;
}

export interface ThrottleRule {
  maxFailures: number;
  windowMs: number;
}

/** Per client IP: 5 wrong passwords per 15 minutes. */
export const PER_IP_RULE: ThrottleRule = { maxFailures: 5, windowMs: 15 * 60 * 1000 };
/** Across all IPs: caps attackers who rotate addresses (IPv6 ranges, botnets). */
export const GLOBAL_RULE: ThrottleRule = { maxFailures: 30, windowMs: 60 * 60 * 1000 };

export function isWindowActive(entry: AttemptWindow | undefined, now: Date, rule: ThrottleRule): entry is AttemptWindow {
  return entry !== undefined && now.getTime() - entry.windowStart.getTime() < rule.windowMs;
}

export function isOverLimit(entry: AttemptWindow | undefined, now: Date, rule: ThrottleRule): boolean {
  return isWindowActive(entry, now, rule) && entry.count >= rule.maxFailures;
}
