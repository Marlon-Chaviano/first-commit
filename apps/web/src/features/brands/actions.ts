"use server";

import { brandLogo, brandProfileSchema, type BrandDetection } from "@kits/schema";
import { revalidatePath } from "next/cache";

import { detectBrandFromUrl } from "@/server/brand-detection";
import { BrandError, deleteBrand, listBrands, saveBrand } from "@/server/brands";
import { OrgError } from "@/server/orgs";
import { getViewer } from "@/server/session";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export async function saveBrandAction(owner: string, profile: unknown): Promise<Result<string>> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Log in" };
  try {
    const slug = await saveBrand(viewer, owner, profile);
    revalidatePath("/brands");
    revalidatePath("/account/brands");
    return { ok: true, data: slug };
  } catch (error) {
    if (error instanceof BrandError || error instanceof OrgError) return { ok: false, error: error.message };
    console.error("[brands]", error);
    return { ok: false, error: "Couldn't save the profile" };
  }
}

export async function deleteBrandAction(slug: string): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Log in" };
  try {
    await deleteBrand(viewer, slug);
    revalidatePath("/brands");
    revalidatePath("/account/brands");
    return { ok: true, data: undefined };
  } catch (error) {
    if (error instanceof BrandError || error instanceof OrgError) return { ok: false, error: error.message };
    return { ok: false, error: "Couldn't delete the profile" };
  }
}

/** Detects a brand from a public website (see server/brand-detection.ts). */
export async function detectBrandFromUrlAction(input: string): Promise<Result<BrandDetection>> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Log in" };
  return detectBrandFromUrl(input);
}

export interface BrandChoice {
  slug: string;
  title: string;
  primary?: string;
  logo?: string;
}

/** The viewer's brand profiles (theirs and their organizations'), for the kit configurator's picker. */
export async function listMyBrandsAction(): Promise<BrandChoice[]> {
  const viewer = await getViewer();
  if (!viewer) return [];
  return (await listBrands(viewer)).map((b) => {
    const profile = brandProfileSchema.safeParse(b.profile);
    const p = profile.success ? profile.data : null;
    return { slug: b.slug, title: p?.title ?? b.slug, primary: p?.colors.primary, logo: p ? (p.assets.icon ?? brandLogo(p)) : undefined };
  });
}
