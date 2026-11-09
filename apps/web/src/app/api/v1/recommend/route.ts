import type { NextRequest } from "next/server";
import { z } from "zod";

import { clientIp } from "@/server/rate-limit";
import { normalizeDescription, recommend, RECOMMEND_LIMIT_MESSAGE, recommendLimit } from "@/server/recommend";

const body = z.object({ description: z.string().trim().min(3, "Describe your project in a few words").max(1000) });

/** POST /api/v1/recommend — { description } → { kit, options, reasons, source }. */
export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  if (!(await recommendLimit.allow(ip))) return Response.json({ error: RECOMMEND_LIMIT_MESSAGE }, { status: 429 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  return Response.json(await recommend(normalizeDescription(parsed.data.description)));
}
