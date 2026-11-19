import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { finishBrand } from "@kits/schema";

import type { BrandTemplate } from "@/features/brands/templates";

/** Embed the local mark so a copied profile also works in the CLI and offline projects. */
export async function draftFromTemplate(template: BrandTemplate) {
  const logo = await readFile(join(process.cwd(), "public", "brand-templates", template.id + ".svg"), "base64");
  return finishBrand({
    colors: template.colors,
    fonts: template.fonts,
    radius: template.radius,
    rules: [template.rule],
    assets: { logo: `data:image/svg+xml;base64,${logo}` },
  }, { name: template.id + "-starter", title: template.title + " starter" });
}
