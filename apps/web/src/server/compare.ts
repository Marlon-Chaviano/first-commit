import "server-only";

import { LIBRARY_CATEGORIES, type Library } from "@kits/schema";

import { getKitStats } from "./metrics/queries";
import { getCatalog, getIndex, getKit } from "./registry";

/** Categories where a head-to-head makes sense (you pick one or the other). */
const KINDS = new Set<Library["kind"]>(["components", "animation", "auth", "email", "i18n", "ai", "observability", "testing", "quality", "deploy"]);

export interface Comparison {
  slug: string;
  a: LibraryUsage;
  b: LibraryUsage;
  category: string;
  sharedFrameworks: string[];
}

export interface LibraryUsage {
  library: Library;
  /** Official kits that offer it. */
  kits: string[];
  /** Installs that chose it, across official kits. */
  installs: number;
}

/** "shadcn-vs-heroui" for every pair of the same category that share a framework. */
export async function getComparisonSlugs(): Promise<string[]> {
  const catalog = await getCatalog();
  const slugs: string[] = [];
  for (const kind of KINDS) {
    const libs = catalog.filter((l) => l.kind === kind).sort((x, y) => x.id.localeCompare(y.id));
    for (const [i, a] of libs.entries()) {
      for (const b of libs.slice(i + 1)) {
        // Same name = two platform variants of one library (Sentry for Next.js vs Node): not a comparison.
        if (a.name !== b.name && a.frameworks.some((f) => b.frameworks.includes(f))) slugs.push(`${a.id}-vs-${b.id}`);
      }
    }
  }
  return slugs;
}

export async function getComparison(slug: string): Promise<Comparison | null> {
  if (!(await getComparisonSlugs()).includes(slug)) return null;
  const catalog = await getCatalog();
  const [aId, bId] = slug.split("-vs-");
  const a = catalog.find((l) => l.id === aId)!;
  const b = catalog.find((l) => l.id === bId)!;
  const category = LIBRARY_CATEGORIES.find((c) => c.kind === a.kind)!;

  const official = await Promise.all((await getIndex()).map(async (e) => ({ name: e.name, kit: await getKit(e.name), stats: await getKitStats(e.name) })));
  const usage = (lib: Library): LibraryUsage => {
    const offering = official.filter((o) => o.kit?.options.some((opt) => opt.id === category.optionId && opt.choices.some((c) => c.id === lib.id)));
    return {
      library: lib,
      kits: offering.map((o) => o.name),
      installs: offering.reduce((sum, o) => sum + (o.stats.breakdown[`${category.optionId}=${lib.id}`] ?? 0), 0),
    };
  };
  return { slug, a: usage(a), b: usage(b), category: category.label, sharedFrameworks: a.frameworks.filter((f) => b.frameworks.includes(f)) };
}
