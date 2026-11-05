import "server-only";

import { parseSkillRef } from "@kits/schema";
import { cacheLife } from "next/cache";

import type { SkillAudit } from "@/lib/audits";
import { worstRisk } from "@/lib/audits";

const PROVIDERS: Record<string, string> = { ath: "Gen Agent Trust Hub", socket: "Socket", snyk: "Snyk" };

/**
 * Security audits of each skill, as published by skills.sh (the same endpoint
 * its CLI shows before installing). Undocumented, so any failure just means
 * "no audit shown". Cached for a day.
 */
export async function getSkillAudits(refs: string[]): Promise<Record<string, SkillAudit>> {
  "use cache";
  cacheLife("days");

  const bySource = new Map<string, string[]>();
  for (const ref of refs) {
    const { source, skill } = parseSkillRef(ref);
    bySource.set(source, [...(bySource.get(source) ?? []), skill]);
  }

  const out: Record<string, SkillAudit> = {};
  await Promise.all(
    [...bySource].map(async ([source, skills]) => {
      try {
        const params = new URLSearchParams({ source, skills: skills.join(",") });
        const res = await fetch(`https://www.skills.sh/tele/audit?${params}`, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return;
        const data = (await res.json()) as Record<string, Record<string, { risk?: string }> | undefined>;
        for (const skill of skills) {
          const entry = data[skill];
          if (!entry) continue;
          const providers = Object.entries(entry)
            .filter(([, v]) => typeof v?.risk === "string")
            .map(([id, v]) => ({ name: PROVIDERS[id] ?? id, risk: v.risk! }));
          if (providers.length) out[`${source}@${skill}`] = { risk: worstRisk(providers.map((p) => p.risk)), providers };
        }
      } catch {
        // No audit for this source.
      }
    }),
  );
  return out;
}
