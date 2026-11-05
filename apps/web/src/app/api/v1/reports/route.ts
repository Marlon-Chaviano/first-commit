import { Ratelimit } from "@upstash/ratelimit";
import type { NextRequest } from "next/server";

import { reportSchema } from "@/lib/reports";
import { keys } from "@/server/metrics/keys";
import { isLocalRedis, redis } from "@/server/redis";
import { saveReport } from "@/server/reports";

const ratelimit =
  redis && !isLocalRedis
    ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "1 h"), prefix: `${keys.rateLimit}:reports` })
    : null;

/** POST /api/v1/reports — "Denunciar este kit". */
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  if (ratelimit) {
    try {
      if (!(await ratelimit.limit(ip)).success) return Response.json({ error: "Demasiadas denuncias, prueba más tarde" }, { status: 429 });
    } catch (error) {
      console.error("[reports] rate limiter no disponible", error);
    }
  }
  const parsed = reportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Datos no válidos" }, { status: 400 });
  if (!(await saveReport(parsed.data, ip))) return Response.json({ error: "Denuncias no disponibles" }, { status: 503 });
  return Response.json({ ok: true }, { status: 201 });
}
