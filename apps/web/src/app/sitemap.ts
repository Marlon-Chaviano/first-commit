import { BRAND } from "@kits/schema";
import type { MetadataRoute } from "next";

import { facets } from "@/lib/kit-query";
import { DOCS_PAGES } from "@/lib/site-nav";
import { getComparisonSlugs } from "@/server/compare";
import { ogImageUrl } from "@/server/og";
import { getAllEntries } from "@/server/registry";
import { getStacks } from "@/server/stacks";

/** Public content only changes with a deploy, so the build time is every page's lastModified. */
const BUILT_AT = new Date();

/** Every public page, with the share card of kits and stacks as their image (Google Images reads it). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [kits, stacks, comparisons] = await Promise.all([getAllEntries(), getStacks(), getComparisonSlugs()]);
  const url = (path: string) => `${BRAND.siteUrl}${path}`;
  const lastModified = BUILT_AT;
  return [
    { url: url("/"), lastModified, changeFrequency: "daily", priority: 1 },
    { url: url("/stacks"), lastModified, changeFrequency: "weekly", priority: 0.8 },
    { url: url("/brands"), lastModified, changeFrequency: "monthly", priority: 0.5 },
    { url: url("/changelog"), lastModified, changeFrequency: "weekly", priority: 0.5 },
    ...[...DOCS_PAGES.map((p) => p.href), "/about", "/contact", "/privacy", "/terms"].map((d) => ({ url: url(d), lastModified, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...kits.map((k) => ({
      url: url(`/kits/${k.name}`),
      lastModified,
      changeFrequency: "weekly" as const,
      priority: k.official ? 0.9 : 0.7,
      images: [url(ogImageUrl("kits", k.name))],
    })),
    ...facets(kits)
      .languages.filter((l) => l.count > 0)
      .map((l) => ({ url: url(`/stacks/language/${l.id}`), lastModified, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...stacks.map((s) => ({ url: url(`/stacks/${s.stack.slug}`), lastModified, changeFrequency: "weekly" as const, priority: 0.8, images: [url(ogImageUrl("stacks", s.stack.slug))] })),
    ...comparisons.map((c) => ({ url: url(`/compare/${c}`), lastModified, changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
