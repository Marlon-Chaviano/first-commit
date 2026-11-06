import { describe, expect, it } from "vitest";

import type { BrandDetection } from "./brand-detect";
import { applyDetection, DEFAULT_BRAND_COLORS, emptyBrandProfile, finishBrand, isEmptyDetection, normalizeBrandProfile } from "./brand-draft";
import { brandProfileSchema } from "./brand-profile";
import { slugify } from "./slug";

const detection = (profile: BrandDetection["profile"]): BrandDetection => ({ profile, found: [] });

describe("brand draft", () => {
  it("starts from one neutral palette", () => {
    expect(emptyBrandProfile().colors).toEqual(DEFAULT_BRAND_COLORS);
  });

  it("a detection replaces colors, fonts and radius but never what the person set", () => {
    const draft = brandProfileSchema.parse({
      ...emptyBrandProfile(),
      name: "web",
      title: "Acme",
      description: "Mine",
      assets: { logo: "https://acme.com/mine.svg" },
      social: { x: "https://x.com/mine" },
      rules: ["Keep it calm"],
    });
    const next = applyDetection(
      draft,
      detection({
        title: "Acme Corp",
        description: "Theirs",
        colors: { primary: "#e11d48" },
        fonts: { sans: "Inter" },
        radius: "0.5rem",
        assets: { logo: "https://acme.com/theirs.svg", icon: "https://acme.com/favicon.svg" },
        social: { x: "https://x.com/theirs", github: "https://github.com/acme" },
        rules: ["Theirs"],
      }),
    );
    expect(next.colors.primary).toBe("#e11d48");
    expect(next.colors.background).toBe("#ffffff");
    expect(next.fonts.sans).toBe("Inter");
    expect(next.radius).toBe("0.5rem");
    expect([next.title, next.name, next.description]).toEqual(["Acme", "web", "Mine"]);
    expect(next.assets).toEqual({ logo: "https://acme.com/mine.svg", icon: "https://acme.com/favicon.svg" });
    expect(next.social).toEqual({ x: "https://x.com/mine", github: "https://github.com/acme" });
    expect(next.rules).toEqual(["Keep it calm"]);
  });

  it("a new draft takes its name and identifier from the detection", () => {
    const next = applyDetection(emptyBrandProfile(), detection({ title: "Grialink Studio", colors: {} }));
    expect([next.title, next.name]).toEqual(["Grialink Studio", "grialink-studio"]);
  });

  it("finishes a detection into a valid profile, with readable text on the primary", () => {
    const p = finishBrand({ colors: { primary: "#fde047" } }, { title: "Ácme Café" });
    expect(p.name).toBe("acme-cafe");
    expect(p.colors.background).toBe("#ffffff");
    expect(p.colors.primaryForeground).toBe("#0a0a0a");
  });

  it("moves an old logo into assets and spots empty detections", () => {
    const old = brandProfileSchema.parse({ ...emptyBrandProfile(), logo: "https://acme.com/logo.png" });
    expect(normalizeBrandProfile(old)).toMatchObject({ assets: { logo: "https://acme.com/logo.png" }, logo: undefined });
    expect(isEmptyDetection(detection({ colors: {} }))).toBe(true);
    expect(isEmptyDetection(detection({ colors: {}, assets: { icon: "https://acme.com/f.ico" } }))).toBe(false);
  });

  it("slugify: accents, symbols, length", () => {
    expect(slugify("  Ácme — Inc.  ")).toBe("acme-inc");
    expect(slugify("a".repeat(80), 39)).toHaveLength(39);
    expect(slugify("hello world-", 6)).toBe("hello");
  });
});
