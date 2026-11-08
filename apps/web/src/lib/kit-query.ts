import { entryLanguage, FLAGSHIP_KITS, KIT_CATEGORIES, LANGUAGES, type KitCategory, type RegistryEntry } from "@kits/schema/light";

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

/** Edit distance (Levenshtein), for spotting typos like "supbase" or "fastpi". */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = temp;
    }
  }
  return row[b.length]!;
}

/**
 * When a search finds nothing: kits whose name, tags or libraries are close to what was typed
 * ("supbase" → saas-next-supabase), with the word that matched. Best matches first.
 */
export function suggestKits(entries: RegistryEntry[], q: string, max = 3): { kit: RegistryEntry; word: string }[] {
  const tokens = q.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
  if (!tokens.length) return [];
  const scored = entries.map((kit) => {
    const words = [...new Set([kit.name, ...kit.tags, ...(kit.libraries ?? [])].flatMap((w) => w.toLowerCase().split(/[^a-z0-9.]+/)).filter((w) => w.length >= 3))];
    let score = 0;
    let best = { word: "", d: Infinity };
    for (const token of tokens) {
      const allowed = Math.max(1, Math.floor(token.length / 4));
      for (const word of words) {
        const d = word.startsWith(token) || token.startsWith(word) ? 0 : distance(token, word);
        if (d <= allowed) {
          score += allowed + 1 - d;
          if (d < best.d) best = { word, d };
        }
      }
    }
    // The general-purpose kit wins a tie: it's the safer suggestion.
    return { kit, word: best.word, score: score + (FLAGSHIP_KITS.has(kit.name) ? 0.5 : 0) };
  });
  return scored
    .filter((s) => s.score >= 1)
    .sort((a, b) => b.score - a.score || a.kit.name.localeCompare(b.kit.name))
    .slice(0, max)
    .map(({ kit, word }) => ({ kit, word }));
}
