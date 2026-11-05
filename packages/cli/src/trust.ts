import { isAbsolute } from "node:path";

import { BRAND, splitKitRef } from "@kits/schema";

export type Trust = "local" | "official" | "verified" | "unverified";

/**
 * Local kits are the user's own and official kits are reviewed in the registry.
 * Community kits are trusted only if their version passed `create-first-commit test` in CI;
 * if the API can't be reached, they count as unverified.
 */
export async function kitTrust(ref: string, version: string): Promise<Trust> {
  const { base } = splitKitRef(ref);
  if (base.startsWith(".") || isAbsolute(base)) return "local";
  if (!base.includes("/")) return "official";
  try {
    const api = process.env.KITS_API_URL ?? BRAND.siteUrl;
    const res = await fetch(`${api}/api/v1/verifications?kit=${encodeURIComponent(base)}&version=${encodeURIComponent(version)}`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return "unverified";
    return ((await res.json()) as { verified?: boolean }).verified ? "verified" : "unverified";
  } catch {
    return "unverified";
  }
}
