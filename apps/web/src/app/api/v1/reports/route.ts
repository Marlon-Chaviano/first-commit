import type { NextRequest } from "next/server";

import { reportSchema } from "@/lib/reports";
import { clientIp, rateLimit } from "@/server/rate-limit";
import { saveReport } from "@/server/reports";

const limit = rateLimit("reports", 5, "1 h");

/** POST /api/v1/reports — "Denunciar este kit". */
export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  if (!(await limit.allow(ip))) return Response.json({ error: "Too many reports, try again later" }, { status: 429 });
  const parsed = reportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  if (!(await saveReport(parsed.data, ip))) return Response.json({ error: "Reports unavailable" }, { status: 503 });
  return Response.json({ ok: true }, { status: 201 });
}
