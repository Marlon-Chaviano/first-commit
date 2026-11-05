import "server-only";

import { Redis } from "@upstash/redis";

import { env } from "./env";

/** Upstash REST client (works on serverless/edge). Locally it talks to SRH, see docker-compose.yml. */
export const redis =
  env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN })
    : null;

/**
 * Local Redis (SRH in docker-compose). @upstash/ratelimit needs Upstash-only
 * Lua flags, so rate limits are skipped there.
 */
export const isLocalRedis = /localhost|127\.0\.0\.1/.test(env.UPSTASH_REDIS_REST_URL ?? "");
