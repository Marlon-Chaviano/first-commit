import { LOGO_KEYS, LOGO_PATHS } from "./logo-paths";
import type { Logo } from "./tech-icons";

export type { Logo } from "./tech-icons";

/** Library, framework and tag logos, by key (generated from lib/logo-sources.ts). */
export const LOGOS: Record<string, Logo> = Object.fromEntries(Object.entries(LOGO_KEYS).map(([key, slug]) => [key, { slug, path: LOGO_PATHS[slug]! }]));

/** Logos for a kit's tags, without repeats (Next.js and nextjs → one). */
export function logosFor(keys: readonly string[], max = 4): { key: string; icon: Logo }[] {
  const seen = new Set<string>();
  const out: { key: string; icon: Logo }[] = [];
  for (const key of keys) {
    const icon = LOGOS[key];
    if (!icon || seen.has(icon.slug)) continue;
    seen.add(icon.slug);
    out.push({ key, icon });
    if (out.length === max) break;
  }
  return out;
}
