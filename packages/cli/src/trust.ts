import { isAbsolute } from "node:path";

import { splitKitRef } from "@kits/schema";

import { api } from "./api";

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
  const res = await api<{ verified?: boolean }>(`/api/v1/verifications?kit=${encodeURIComponent(base)}&version=${encodeURIComponent(version)}`, { auth: "none", timeoutMs: 2000 });
  return res.ok && res.data?.verified ? "verified" : "unverified";
}
