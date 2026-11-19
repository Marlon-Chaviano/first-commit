"use server";

import { BRAND_ASSETS, brandLogo, brandProfileSchema, type BrandAssetKind, type BrandDetection } from "@kits/schema";

import { headers } from "next/headers";

import { clientIp, rateLimit } from "@/server/rate-limit";
import { detectBrandFromUrl } from "@/server/brand-detection";
import { action, type Result } from "@/server/action";
import { deleteBrand, listBrands, saveBrand } from "@/server/brands";
import { fail } from "@/server/errors";
import { getViewer } from "@/server/session";

const publicDetectionLimit = rateLimit("brand-detect", 5, "1 h");
const BRANDS = { paths: ["/brands", "/account/brands"] };

export async function saveBrandAction(owner: string, profile: unknown, mode: "create" | "update" = "create"): Promise<Result<string>> {
  return action({ revalidate: BRANDS, failure: "Couldn't save the profile" }, (viewer) => saveBrand(viewer, owner, profile, mode));
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

/** The viewer's brand profiles (theirs and their organizations'), for the kit configurator's picker. */
export async function listMyBrandsAction(): Promise<BrandChoice[]> {
  const viewer = await getViewer();
  if (!viewer) return [];
  return (await listBrands(viewer)).map((b) => {
    const profile = brandProfileSchema.safeParse(b.profile);
    const p = profile.success ? profile.data : null;
    const images = p ? (Object.keys(BRAND_ASSETS) as BrandAssetKind[]).filter((k) => (k === "logo" ? brandLogo(p) : p.assets[k])) : [];
    return { slug: b.slug, title: p?.title ?? b.slug, primary: p?.colors.primary, logo: p ? (p.assets.icon ?? brandLogo(p)) : undefined, images };
  });
}
