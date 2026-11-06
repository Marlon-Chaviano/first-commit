import { readableOn, type BrandDetection } from "./brand-detect";
import { brandProfileSchema, type BrandPalette, type BrandProfile } from "./brand-profile";
import { slugify } from "./slug";

/**
 * A brand profile while it's being made: from a detection, by hand, or both. The one place that
 * decides the defaults, how a detection merges into what the person already set, and how a draft
 * becomes a valid profile. The web creator, the editor and `brand detect` in the CLI all use it.
 */

/** The neutral palette a profile starts with: white background, near-black text and primary. */
export const DEFAULT_BRAND_COLORS = {
  primary: "#0a0a0a",
  primaryForeground: "#ffffff",
  background: "#ffffff",
  foreground: "#0a0a0a",
  border: "#e5e5e5",
} satisfies BrandPalette;

/** Brand identifiers: the "web" in acme/web. */
export const brandSlug = (text: string) => slugify(text, 40);

export function emptyBrandProfile(): BrandProfile {
  return brandProfileSchema.parse({ name: "brand", title: "Brand", colors: DEFAULT_BRAND_COLORS });
}

/** Profiles saved before `assets` existed kept the logo in `logo`: it moves to `assets.logo`. */
export function normalizeBrandProfile(p: BrandProfile): BrandProfile {
  const logo = p.assets?.logo ?? p.logo;
  return { ...p, assets: { ...p.assets, ...(logo ? { logo } : {}) }, social: p.social ?? {}, logo: undefined };
}

/** Nothing usable was found: no colors, name, fonts or images. */
export function isEmptyDetection(d: BrandDetection): boolean {
  const p = d.profile;
  return !Object.keys(p.colors).length && !p.title && !Object.keys(p.fonts ?? {}).length && !Object.keys(p.assets ?? {}).length;
}

/**
 * Applies a detection to a draft. What detection is for, it replaces: colors, dark palette, fonts and
 * radius. What the person already set, it never overwrites: name, logo and images, links, description,
 * voice, rules and docs only fill in when empty. `keepName` keeps the identifier of a saved profile.
 */
export function applyDetection(draft: BrandProfile, d: BrandDetection, { keepName = false } = {}): BrandProfile {
  const p = d.profile;
  const title = draft.title && draft.title !== "Brand" ? draft.title : (p.title ?? draft.title);
  return brandProfileSchema.parse({
    ...draft,
    title,
    name: keepName || (draft.name && draft.name !== "brand") ? draft.name : brandSlug(title) || draft.name,
    colors: { ...draft.colors, ...p.colors },
    ...(p.dark ? { dark: p.dark } : {}),
    fonts: { ...draft.fonts, ...p.fonts },
    radius: p.radius ?? draft.radius,
    assets: { ...p.assets, ...draft.assets },
    social: { ...p.social, ...draft.social },
    website: draft.website ?? p.website,
    description: draft.description || p.description,
    voice: draft.voice || p.voice,
    rules: draft.rules.length ? draft.rules : (p.rules ?? []),
    docs: { ...p.docs, ...draft.docs },
  });
}

/**
 * Finishes a draft into a valid profile: missing required colors get the defaults, the text on the
 * primary is computed when unset, and the name is slugged. Throws (zod) if something can't be fixed.
 */
export function finishBrand(input: BrandDetection["profile"], { name, title }: { name?: string; title?: string } = {}): BrandProfile {
  const colors = { ...DEFAULT_BRAND_COLORS, primaryForeground: undefined, ...input.colors } as Partial<BrandPalette>;
  colors.primaryForeground ??= readableOn(colors.primary!);
  const finalTitle = title || input.title || name || "Brand";
  return brandProfileSchema.parse({
    rules: [],
    docs: {},
    fonts: {},
    social: {},
    assets: {},
    ...input,
    logo: undefined,
    name: brandSlug(name || finalTitle) || "brand",
    title: finalTitle,
    colors,
  });
}

/** A complete, valid profile from a detection, for `brand detect`. */
export function completeProfile(d: BrandDetection, name: string, title: string): BrandProfile {
  return finishBrand(d.profile, { name, title: d.profile.title ?? title });
}
