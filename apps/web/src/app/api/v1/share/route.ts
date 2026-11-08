import { BRAND } from "@kits/schema";
import type { NextRequest } from "next/server";

import { DomainError } from "@/server/errors";
import { clientIp, rateLimit } from "@/server/rate-limit";
import { shareConfig, shareInput } from "@/server/share";

const limit = rateLimit("share", 30, "1 h");

/** POST /api/v1/share — { kit, selections, name? } → { id, url }: the short link for a configuration. */
export async function POST(request: NextRequest) {
  if (!(await limit.allow(clientIp(request)))) return Response.json({ error: "Too many links, try again later" }, { status: 429 });
  const parsed = shareInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  try {
    const id = await shareConfig(parsed.data);
    return Response.json({ id, url: `${BRAND.siteUrl}/k/${id}` }, { status: 201 });
  } catch (error) {
    if (error instanceof DomainError) return Response.json({ error: error.message }, { status: error.status });
    console.error("[share]", error);
    return Response.json({ error: "Couldn't create the link" }, { status: 500 });
  }
}
