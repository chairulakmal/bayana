// In-memory fixed-window rate limiter (SPEC §11.3 #5).
//
// WHY in-memory: Bayana launches single-user on one Railway (Hobby) instance, so a
// process-local counter is enough — no Redis/Postgres round-trip and zero dependencies.
// The trade-offs are deliberate and acceptable here: limits RESET on every redeploy and
// are NOT shared if we ever run more than one replica. If either becomes a problem
// (multi-replica, or wanting limits to survive restarts), swap this module for a
// Postgres- or Redis-backed store — the call sites in proxy.ts don't change. (SPEC §16.)
//
// WHY fixed-window (vs. sliding-window or token-bucket): it's the simplest correct option
// and the small burst tolerated at a window boundary (up to ~2× the limit across two
// adjacent windows) is irrelevant for an abuse guard on a near-zero-traffic endpoint.
// Each key gets a count that resets when its window elapses.

/** Outcome of a single rate-limit check. */
export type RateLimitResult = {
  /** True if the request is within the limit and may proceed. */
  allowed: boolean;
  /** Seconds until the current window resets. 0 when `allowed` is true. */
  retryAfterSeconds: number;
};

/** Internal per-key state: how many hits so far, and when the window ends (epoch ms). */
type Window = { count: number; resetAt: number };

// Cap on distinct keys we track, so a flood of unique IPs can't grow the Map without
// bound. When exceeded we prune already-expired windows (cheap, amortized) before adding.
const MAX_TRACKED_KEYS = 10_000;

/**
 * Create an isolated fixed-window limiter. Each returned `check` closes over its own
 * Map, so different limiters (per-IP, global, …) keep independent counters.
 *
 * @param opts.limit    Max allowed hits per key within one window.
 * @param opts.windowMs Window length in milliseconds.
 * @returns A `check(key)` function; call once per request with the key to throttle on
 *          (e.g. client IP, or a constant like "global").
 */
export function createRateLimiter(opts: { limit: number; windowMs: number }) {
  // Module-scoped via the closure: persists for the life of the Node process (same
  // lifetime caveat as noted above — it's wiped on redeploy).
  const buckets = new Map<string, Window>();

  return function check(key: string): RateLimitResult {
    const now = Date.now();
    const bucket = buckets.get(key);

    // No window yet, or the previous one elapsed → start a fresh window at count 1.
    if (!bucket || now >= bucket.resetAt) {
      if (buckets.size >= MAX_TRACKED_KEYS) pruneExpired(buckets, now);
      buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }

    // Within the active window and still under the limit → count it and allow.
    if (bucket.count < opts.limit) {
      bucket.count += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    }

    // Over the limit for this window → reject and tell the caller when to retry.
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  };
}

/** Drop windows that have already elapsed, reclaiming memory from stale keys. */
function pruneExpired(buckets: Map<string, Window>, now: number) {
  for (const [key, window] of buckets) {
    if (now >= window.resetAt) buckets.delete(key);
  }
}
