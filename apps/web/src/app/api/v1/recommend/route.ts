import { Ratelimit } from "@upstash/ratelimit";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { keys } from "@/server/metrics/keys";
import { normalizeDescription, recommend } from "@/server/recommend";
import { isLocalRedis, redis } from "@/server/redis";

// Each new description can be a paid Claude call: keep it to a few per IP.
const ratelimit =
  redis && !isLocalRedis
    ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, "1 h"), prefix: `${keys.rateLimit}:recommend` })
    : null;

const body = z.object({ description: z.string().trim().min(3, "Describe tu proyecto en unas palabras").max(1000) });

/** POST /api/v1/recommend — { description } → { kit, options, reasons, source }. */
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  if (ratelimit) {
    try {
      if (!(await ratelimit.limit(ip)).success) return Response.json({ error: "Demasiadas recomendaciones, prueba más tarde" }, { status: 429 });
    } catch (error) {
      console.error("[recommend] rate limiter no disponible", error);
    }
  }
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Datos no válidos" }, { status: 400 });
  return Response.json(await recommend(normalizeDescription(parsed.data.description)));
}
