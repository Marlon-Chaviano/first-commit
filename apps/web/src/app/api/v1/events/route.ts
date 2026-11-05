import { installEventSchema } from "@kits/schema";
import { Ratelimit } from "@upstash/ratelimit";
import type { NextRequest } from "next/server";

import { recordInstall } from "@/server/metrics/ingest";
import { keys } from "@/server/metrics/keys";
import { isLocalRedis, redis } from "@/server/redis";
import { getIndex } from "@/server/registry";

// @upstash/ratelimit's Lua scripts use an Upstash-only flag, so the limiter is
// skipped against the local Redis from docker-compose (it works on Upstash).
const ratelimit = redis && !isLocalRedis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, "1 m"), prefix: keys.rateLimit, analytics: false })
  : null;

/**
 * POST /api/v1/events — install telemetry from the CLI.
 * Always answers fast and never with details: the CLI fires and forgets.
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  if (ratelimit) {
    try {
      const { success } = await ratelimit.limit(ip);
      if (!success) return new Response(null, { status: 429 });
    } catch (error) {
      // Fail open: a broken limiter must not block install counting.
      console.error("[events] rate limiter unavailable", error);
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = installEventSchema.safeParse(body);
  if (!parsed.success) return new Response(null, { status: 400 });

  const kit = parsed.data.kit;
  const official = (await getIndex()).some((e) => e.name === kit);
  const country = request.headers.get("x-vercel-ip-country");
  try {
    await recordInstall(parsed.data, { official, country });
  } catch (error) {
    // Losing one event is better than failing the user's install.
    console.error("[events] could not record install", error);
  }
  return new Response(null, { status: 202 });
}
