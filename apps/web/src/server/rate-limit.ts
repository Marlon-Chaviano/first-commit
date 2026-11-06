import "server-only";

import { Ratelimit } from "@upstash/ratelimit";

import { keys } from "./metrics/keys";
import { isLocalRedis, redis } from "./redis";

type Window = `${number} ${"s" | "m" | "h" | "d"}`;

export interface RateLimit {
  /**
   * True when `key` (an IP, a user id) may go on. Fails open: without Redis, against the local Redis
   * (its Lua scripts use an Upstash-only flag) or when Upstash errors, nothing is blocked.
   */
  allow(key: string): Promise<boolean>;
}

/** A named sliding-window limit: `rateLimit("contact", 3, "1 h")`. Counters are per name. */
export function rateLimit(name: string, max: number, window: Window): RateLimit {
  const limiter = redis && !isLocalRedis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(max, window), prefix: `${keys.rateLimit}:${name}`, analytics: false }) : null;
  return {
    async allow(key) {
      if (!limiter) return true;
      try {
        return (await limiter.limit(key)).success;
      } catch (error) {
        console.error(`[rate-limit:${name}] unavailable`, error);
        return true;
      }
    },
  };
}

/** The caller's IP behind Vercel's proxy (first x-forwarded-for hop), or "anonymous". */
export function clientIp(source: Request | Headers): string {
  const headers = source instanceof Headers ? source : source.headers;
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
}
