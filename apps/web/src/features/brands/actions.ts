"use server";

import type { BrandAssetKind, BrandDetection } from "@kits/schema";

import { headers } from "next/headers";

import { clientIp, rateLimit } from "@/server/rate-limit";
import { detectBrandFromUrl } from "@/server/brand-detection";
import { action, type Result } from "@/server/action";
import { availableBrandChoices, deleteBrand, saveBrand } from "@/server/brands";
import { fail } from "@/server/errors";
import { getViewer } from "@/server/session";

const publicDetectionLimit = rateLimit("brand-detect", 5, "1 h");
const BRANDS = { paths: ["/brands", "/account/brands"] };

export async function saveBrandAction(owner: string, profile: unknown, mode: "create" | "update" = "create", isPrivate?: boolean): Promise<Result<string>> {
  // Pre-visibility forms promised a private save and omitted this argument.
  const visibility = mode === "create" ? isPrivate ?? true : isPrivate;
  return action({ revalidate: BRANDS, failure: "Couldn't save the profile" }, (viewer) => saveBrand(viewer, owner, profile, mode, visibility));
}

export async function deleteBrandAction(slug: string): Promise<Result> {
  return action({ revalidate: BRANDS, failure: "Couldn't delete the profile" }, (viewer) => deleteBrand(viewer, slug));
}

/** Detects a brand from a public website (see server/brand-detection.ts). */
export async function detectBrandFromUrlAction(input: string): Promise<Result<BrandDetection>> {
  return action({ auth: "optional" }, async (viewer) => {
    if (!viewer && !(await publicDetectionLimit.allow(clientIp(await headers())))) return fail("Too many website imports. Try again later or upload a file.", 429);
    const detected = await detectBrandFromUrl(input);
    return detected.ok ? detected.data : fail(detected.error);
  });
}

export interface BrandChoice {
  slug: string;
  title: string;
  primary?: string;
  logo?: string;
  /** Which images the profile brings, for the plan ("Download brand images: logo, favicon"). */
  images: BrandAssetKind[];
}

/** Public profiles and profiles shared with the viewer, for the kit configurator. */
export async function listAvailableBrandsAction(): Promise<BrandChoice[]> {
  return availableBrandChoices(await getViewer());
}
