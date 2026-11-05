/**
 * Redis key layout. Redis (Upstash, free tier) is only a buffer and a rate
 * limiter: events wait in a list until the flush job writes them to Postgres,
 * which holds every counter. See docs/ARCHITECTURE.md → "Presupuesto de Upstash".
 */
const P = "kits";

export const keys = {
  /** list — raw events waiting to be flushed to Postgres (LPUSH in, LRANGE + LTRIM out) */
  queue: `${P}:queue:events`,
  /** prefix for @upstash/ratelimit */
  rateLimit: `${P}:rl`,
} as const;

/** "2026-11-04" — the UTC day bucket. */
export function dayBucket(date: Date): string {
  return date.toISOString().slice(0, 10);
}
