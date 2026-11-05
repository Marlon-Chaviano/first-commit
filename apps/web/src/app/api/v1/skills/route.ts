import { cacheLife } from "next/cache";
import type { NextRequest } from "next/server";

export interface SkillResult {
  ref: string;
  name: string;
  source: string;
  installs: number;
}

// skills.sh has no documented public API; this is the endpoint its own search uses.
// Failures return an empty list so the configurator keeps working.
async function search(q: string): Promise<SkillResult[]> {
  "use cache";
  cacheLife("hours");
  try {
    const res = await fetch(`https://skills.sh/api/search?q=${encodeURIComponent(q)}&limit=8`);
    if (!res.ok) return [];
    const data = (await res.json()) as { skills?: { source: string; skillId: string; name: string; installs: number }[] };
    return (data.skills ?? []).map((s) => ({
      ref: `${s.source}@${s.skillId}`,
      name: s.name,
      source: s.source,
      installs: s.installs,
    }));
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim().slice(0, 80) ?? "";
  if (q.length < 2) return Response.json([]);
  return Response.json(await search(q));
}
