import { BRAND, LANGUAGES } from "@kits/schema";
import type { MetadataRoute } from "next";

import { getComparisonSlugs } from "@/server/compare";
import { getAllEntries } from "@/server/registry";
import { getStacks } from "@/server/stacks";

const DOCS = ["/docs", "/docs/referencia", "/docs/bibliotecas", "/docs/mantener", "/docs/agentes"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [kits, stacks, comparisons] = await Promise.all([getAllEntries(), getStacks(), getComparisonSlugs()]);
  const url = (path: string) => `${BRAND.siteUrl}${path}`;
  return [
    { url: url("/"), changeFrequency: "daily", priority: 1 },
    { url: url("/stacks"), changeFrequency: "weekly", priority: 0.8 },
    { url: url("/novedades"), changeFrequency: "weekly", priority: 0.5 },
    ...DOCS.map((d) => ({ url: url(d), changeFrequency: "monthly" as const, priority: 0.6 })),
    ...kits.map((k) => ({ url: url(`/kits/${k.name}`), changeFrequency: "weekly" as const, priority: k.official ? 0.9 : 0.7 })),
    ...LANGUAGES.filter((l) => kits.some((k) => (k.language ?? "typescript") === l.id)).map((l) => ({ url: url(`/stacks/lenguaje/${l.id}`), changeFrequency: "weekly" as const, priority: 0.8 })),
    ...stacks.map((s) => ({ url: url(`/stacks/${s.stack.slug}`), changeFrequency: "weekly" as const, priority: 0.8 })),
    ...comparisons.map((c) => ({ url: url(`/comparar/${c}`), changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
