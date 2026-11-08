import "server-only";

import { z } from "zod";

/**
 * Every service is optional: without Redis or Postgres the site still renders
 * (counters show 0) and the events endpoint accepts and drops events. That
 * keeps `pnpm dev` working with zero setup; `docker compose up` turns it all on.
 */
const schema = z.object({
  UPSTASH_REDIS_REST_URL: z.url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  DATABASE_URL: z.url().optional(),
  /** Manual runs of scheduled jobs: `Authorization: Bearer <CRON_SECRET>`. */
  CRON_SECRET: z.string().min(16).optional(),
  /** QStash calls scheduled jobs; these verify its signature. */
  QSTASH_CURRENT_SIGNING_KEY: z.string().min(1).optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().min(1).optional(),
  /** Better Auth: min 32 chars (openssl rand -base64 32) and the site URL. */
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  BETTER_AUTH_URL: z.url().optional(),
  /** GitHub OAuth app (created in phase 8). */
  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
  /** Google OAuth client (phase 8). Callback: <BETTER_AUTH_URL>/api/auth/callback/google */
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  /** Comma-separated handles that get the admin role. */
  ADMIN_HANDLES: z.string().optional(),
  /** "1": email + password login for local development. Ignored in production. */
  DEV_LOGIN: z.enum(["1", "0"]).optional(),
  /** Salt for hashing reporter IPs (kit reports). */
  IP_HASH_SALT: z.string().min(16).optional(),
  /** Optional: email the team on every kit report (https://resend.com). */
  RESEND_API_KEY: z.string().min(1).optional(),
  REPORTS_EMAIL: z.email().optional(),
  /** Sender for every email ("kits <hola@dominio>"); Resend's test sender by default. */
  EMAIL_FROM: z.string().min(3).optional(),
  /** "1"/"true": use the local QStash dev server and its fixed signing keys. */
  QSTASH_DEV: z.enum(["1", "true", "0", "false"]).optional(),
  /** Stripe (phase 7). Without the secret key, billing and premium kits are off. */
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_PRICE_PRO: z.string().min(1).optional(),
  STRIPE_PRICE_TEAM: z.string().min(1).optional(),
  /** Local tests against stripe-mock (docker compose): http://localhost:12111 */
  STRIPE_API_URL: z.url().optional(),
  /** Platform commission on premium kits, in percent. */
  PLATFORM_FEE_PERCENT: z.coerce.number().min(0).max(50).default(15),
  /** Optional: xAI's Grok for "Describe your project". Without it the keyword recommender answers. */
  XAI_API_KEY: z.string().min(1).optional(),
  /** Grok model for the recommender. A fast non-reasoning one: the task is picking from a list. */
  RECOMMEND_MODEL: z.string().default("grok-4.20-non-reasoning"),
});

export const env = schema.parse({
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || undefined,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || undefined,
  DATABASE_URL: process.env.DATABASE_URL || undefined,
  CRON_SECRET: process.env.CRON_SECRET || undefined,
  QSTASH_CURRENT_SIGNING_KEY: process.env.QSTASH_CURRENT_SIGNING_KEY || undefined,
  QSTASH_NEXT_SIGNING_KEY: process.env.QSTASH_NEXT_SIGNING_KEY || undefined,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || undefined,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || undefined,
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || undefined,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || undefined,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || undefined,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || undefined,
  ADMIN_HANDLES: process.env.ADMIN_HANDLES || undefined,
  DEV_LOGIN: (process.env.DEV_LOGIN || undefined) as "1" | "0" | undefined,
  IP_HASH_SALT: process.env.IP_HASH_SALT || undefined,
  RESEND_API_KEY: process.env.RESEND_API_KEY || undefined,
  REPORTS_EMAIL: process.env.REPORTS_EMAIL || undefined,
  EMAIL_FROM: process.env.EMAIL_FROM || undefined,
  QSTASH_DEV: (process.env.QSTASH_DEV || undefined) as "1" | "true" | "0" | "false" | undefined,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || undefined,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || undefined,
  STRIPE_PRICE_PRO: process.env.STRIPE_PRICE_PRO || undefined,
  STRIPE_PRICE_TEAM: process.env.STRIPE_PRICE_TEAM || undefined,
  STRIPE_API_URL: process.env.STRIPE_API_URL || undefined,
  PLATFORM_FEE_PERCENT: process.env.PLATFORM_FEE_PERCENT || undefined,
  XAI_API_KEY: process.env.XAI_API_KEY || undefined,
  RECOMMEND_MODEL: process.env.RECOMMEND_MODEL || undefined,
});

export const qstashDev = env.QSTASH_DEV === "1" || env.QSTASH_DEV === "true";

/** Email + password login, only for local development. */
export const devLogin = env.DEV_LOGIN === "1" && process.env.NODE_ENV !== "production";
export const githubLogin = Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
export const googleLogin = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
export const adminHandles = new Set((env.ADMIN_HANDLES ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean));
/** ADMIN_HANDLES applies on every read, so accounts created before it was set are admins too. */
export const effectiveRole = (handle: string | null, role: string | null): string | null =>
  handle && adminHandles.has(handle.toLowerCase()) ? "admin" : role;
