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
    console.error("[verifications] unavailable", error);
    return { verified: false, platforms: [] };
  }
}

/**
 * How long the default install takes, from the latest passing CI reports of this version: the
 * median of their "defaults" combination, in minutes. It includes the checks (first build, tests),
 * so it's an upper bound. Null until a report exists.
 */
export async function getInstallMinutes(kit: string, version: string): Promise<number | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(verificationTag(kit));

  if (!db) return null;
  try {
    const rows = await db
      .select({ report: kitVerifications.report })
      .from(kitVerifications)
      .where(and(eq(kitVerifications.kit, kit), eq(kitVerifications.version, version), eq(kitVerifications.ok, true)))
      .orderBy(desc(kitVerifications.createdAt))
      .limit(6);
    const durations = rows
      .map((r) => r.report.combinations.find((c) => c.label === "defaults" && c.ok)?.durationMs)
      .filter((ms): ms is number => typeof ms === "number" && ms > 0)
      .sort((a, b) => a - b);
    if (!durations.length) return null;
    const median = durations[Math.floor(durations.length / 2)]!;
    return Math.max(1, Math.round(median / 60_000));
  } catch (error) {
    console.error("[verifications] install time unavailable", error);
    return null;
  }
}
