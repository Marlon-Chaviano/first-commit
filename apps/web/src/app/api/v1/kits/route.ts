import { cliCommand } from "@kits/schema";
import { Ratelimit } from "@upstash/ratelimit";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { keys } from "@/server/metrics/keys";
import { publishKit, PublishError } from "@/server/publish";
import { isLocalRedis, redis } from "@/server/redis";
import { getAllEntries } from "@/server/registry";
import { getRequestUser } from "@/server/session";

const publishLimit =
  redis && !isLocalRedis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 h"), prefix: `${keys.rateLimit}:publish` }) : null;

/** GET /api/v1/kits?q=&category=&official=1|0 — official and community kits. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.toLowerCase().trim();
  const category = params.get("category");
  const official = params.get("official");
  const kits = (await getAllEntries()).filter(
    (k) =>
      (!q || [k.name, k.title, k.description, ...k.tags].some((t) => t.toLowerCase().includes(q))) &&
      (!category || k.category === category) &&
      (official === null || String(Boolean(k.official)) === String(official === "1")),
  );
  return Response.json({ kits });
}

const publishBody = z.object({
  repo: z.string().max(200).optional(),
  path: z.string().max(300).optional(),
  ref: z.string().max(200).optional(),
  local: z.string().max(500).optional(),
  org: z.string().max(39).optional(),
});

/** POST /api/v1/kits — publish a version. Browser session or `Authorization: Bearer kits_…`. */
export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return Response.json({ error: `Log in or use a token (${cliCommand("login")})` }, { status: 401 });
  if (publishLimit) {
    try {
      if (!(await publishLimit.limit(user.id)).success) return Response.json({ error: "Too many publishes, try again in an hour" }, { status: 429 });
    } catch (error) {
      console.error("[publish] rate limiter unavailable", error);
    }
  }
  const parsed = publishBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid data" }, { status: 400 });
  try {
    const result = await publishKit(user, parsed.data);
    return Response.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof PublishError) return Response.json({ error: error.message }, { status: error.status });
    console.error("[publish]", error);
    return Response.json({ error: "Couldn't publish" }, { status: 500 });
  }
}
