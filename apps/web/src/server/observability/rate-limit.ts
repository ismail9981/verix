/*
 * Fixed-window rate limiter (Edge-safe: pure Map + Date.now, no Node APIs).
 *
 * NOTE: state is per-runtime-instance, so on multi-instance serverless this is
 * best-effort brute-force mitigation, not a global quota. For a hard global
 * limit, back this with a shared store (e.g. Upstash Redis) — the call sites
 * stay the same.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 10_000;

export interface RateLimitResult {
  limited: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now > existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, remaining: limit - 1, resetAt: now + windowMs };
  }

  existing.count += 1;

  // Opportunistic cleanup so the map can't grow unbounded.
  if (buckets.size > MAX_TRACKED_KEYS) {
    for (const [k, v] of buckets) {
      if (now > v.resetAt) buckets.delete(k);
    }
  }

  return {
    limited: existing.count > limit,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
  };
}
