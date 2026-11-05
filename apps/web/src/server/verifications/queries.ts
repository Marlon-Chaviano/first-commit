import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { db } from "../db";
import { kitVerifications } from "../db/schema";

export interface VerificationStatus {
  verified: boolean;
  /** Latest result per platform (linux, darwin…). */
  platforms: { platform: string; ok: boolean; at: string; commitSha: string }[];
}

export const verificationTag = (kit: string) => `verification:${kit}`;

/** A version is verified when the latest report on every platform tested passed. */
export async function getVerification(kit: string, version: string): Promise<VerificationStatus> {
  "use cache";
  cacheLife("hours");
  cacheTag(verificationTag(kit));

  if (!db) return { verified: false, platforms: [] };
  try {
    const rows = await db
      .select({
        platform: kitVerifications.platform,
        ok: kitVerifications.ok,
        createdAt: kitVerifications.createdAt,
        commitSha: kitVerifications.commitSha,
      })
      .from(kitVerifications)
      .where(and(eq(kitVerifications.kit, kit), eq(kitVerifications.version, version)))
      .orderBy(desc(kitVerifications.createdAt))
      .limit(50);
    const latest = new Map<string, (typeof rows)[number]>();
    for (const row of rows) if (!latest.has(row.platform)) latest.set(row.platform, row);
    const platforms = [...latest.values()].map((r) => ({
      platform: r.platform,
      ok: r.ok,
      at: r.createdAt.toISOString(),
      commitSha: r.commitSha,
    }));
    return { verified: platforms.length > 0 && platforms.every((p) => p.ok), platforms };
  } catch (error) {
    console.error("[verifications] no disponible", error);
    return { verified: false, platforms: [] };
  }
}
