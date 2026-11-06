import { installEventSchema } from "@kits/schema";
import type { NextRequest } from "next/server";

import { recordInstall } from "@/server/metrics/ingest";
import { clientIp, rateLimit } from "@/server/rate-limit";
import { getIndex } from "@/server/registry";

const limit = rateLimit("events", 30, "1 m");

/**
 * POST /api/v1/events — install telemetry from the CLI.
 * Always answers fast and never with details: the CLI fires and forgets.
 */
export async function POST(request: NextRequest) {
  // Fails open: a broken limiter must not block install counting.
  if (!(await limit.allow(clientIp(request)))) return new Response(null, { status: 429 });

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
