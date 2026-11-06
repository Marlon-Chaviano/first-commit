import type { NextRequest } from "next/server";
import { z } from "zod";

import { normalizeDescription, recommend } from "@/server/recommend";
import { clientIp, rateLimit } from "@/server/rate-limit";

// Each new description can be a paid Claude call: keep it to a few per IP.
const limit = rateLimit("recommend", 20, "1 h");

const body = z.object({ description: z.string().trim().min(3, "Describe your project in a few words").max(1000) });

/** POST /api/v1/recommend — { description } → { kit, options, reasons, source }. */
export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  if (!(await limit.allow(ip))) return Response.json({ error: "Too many recommendations, try again later" }, { status: 429 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  return Response.json(await recommend(normalizeDescription(parsed.data.description)));
}
