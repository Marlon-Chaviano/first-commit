import { entryLanguage, FLAGSHIP_KITS, KIT_CATEGORIES, LANGUAGES, type KitCategory, type RegistryEntry } from "@kits/schema";

export type KitOrigin = "all" | "official" | "community" | "verified";

export interface KitQuery {
  /** Free text: name, title, description, tags or a library ("stripe"). */
  q?: string;
  origin?: KitOrigin;
  category?: KitCategory | "all";
  language?: string;
  /** installs: most installed first. catalog: by category, the general-purpose kit of each first. */
  sort?: "installs" | "catalog";
}

/**
 * Below this many installs in total, a ranking reads as "nobody uses it": the list is shown as a
 * catalog (by category, no install columns) until the numbers say something.
 */
export const RANKING_MIN_INSTALLS = 100;

export interface KitRanking {
  /** kit → installs, the sort key (most installed first, then by name). */
  counts: Record<string, number>;
  /** kit → its current version passed `create-first-commit test`. */
  verified: Record<string, boolean>;
}

/**
 * Lowercased search text per kit. Build it once per list (not per keystroke)
 * and pass it to queryKits.
 */
export function searchIndex(entries: RegistryEntry[]): Map<string, string> {
  return new Map(entries.map((k) => [k.name, [k.name, k.title, k.description, ...k.tags, ...(k.libraries ?? [])].join("\n").toLowerCase()]));
}

/** The kits that match a query, ranked by installs. */
export function queryKits(
  entries: RegistryEntry[],
  { q = "", origin = "all", category = "all", language = "all", sort = "installs" }: KitQuery,
  { counts, verified }: KitRanking,
  index: Map<string, string> = searchIndex(entries),
): RegistryEntry[] {
  const text = q.trim().toLowerCase();
  return entries
    .filter((k) => !text || index.get(k.name)?.includes(text))
    .filter((k) => (origin === "official" ? k.official : origin === "community" ? !k.official : origin === "verified" ? verified[k.name] : true))
    .filter((k) => category === "all" || k.category === category)
    .filter((k) => language === "all" || entryLanguage(k) === language)
    .sort(sort === "catalog" ? byCatalog : (a, b) => (counts[b.name] ?? 0) - (counts[a.name] ?? 0) || a.name.localeCompare(b.name));
}

/** Category order, then the general-purpose kit of the category, official before community, then by name. */
function byCatalog(a: RegistryEntry, b: RegistryEntry): number {
  return (
    KIT_CATEGORIES.indexOf(a.category) - KIT_CATEGORIES.indexOf(b.category) ||
    Number(FLAGSHIP_KITS.has(b.name)) - Number(FLAGSHIP_KITS.has(a.name)) ||
    Number(b.official) - Number(a.official) ||
    a.name.localeCompare(b.name)
  );
}

/** The categories that have kits, and every language (catalog order) with its number of kits. */
export function facets(entries: RegistryEntry[]) {
  const categories = [...new Set(entries.map((k) => k.category))];
  const languages = LANGUAGES.map((l) => ({ ...l, count: entries.filter((k) => entryLanguage(k) === l.id).length }));
  return { categories, languages };
}
