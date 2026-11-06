import { resolveExtends, splitKitRef, type LoadedRawKit, type PathResolver, type RawKitLoader } from "./extends";
import { expandKit, type Catalog } from "./libraries";
import { defaultSelections, validateSelections } from "./resolve";
import { parseKit, type Kit } from "./schema";
import { testCombinations } from "./verify";

/**
 * Where kits come from: the CLI (a download, a local path), the website (the
 * registry folder and published manifests) or a test (the registry folder).
 */
export interface KitSource {
  /** Raw kit.json and its folder for a reference (the parents in `extends`). */
  read: RawKitLoader;
  /** The library catalog every kit expands against. */
  catalog: () => Promise<Catalog>;
  /** Joins a kit folder and one of its relative paths. */
  resolvePath: PathResolver;
}

/**
 * A kit exactly as the CLI and the website use it: `extends` resolved, parsed,
 * catalog libraries expanded. With `admit`, it must also be installable as
 * published (see admitKit). Throws a readable error otherwise.
 */
export async function loadKitFrom(top: LoadedRawKit, source: KitSource, { admit = false }: { admit?: boolean } = {}): Promise<Kit> {
  const kit = expandKit(parseKit(await resolveExtends(top, source.read, source.resolvePath)), await source.catalog());
  if (admit) admitKit(kit);
  return kit;
}

/** What publishing and the registry require: the defaults and every `verify.matrix` entry are valid combinations. */
export function admitKit(kit: Kit): void {
  validateSelections(kit, defaultSelections(kit));
  testCombinations(kit);
}

/** Official kits are named by a bare slug ("landing-next"); community ones are "owner/kit". */
export function isOfficialKitName(ref: string): boolean {
  return /^[a-z0-9-]+$/.test(splitKitRef(ref).base);
}
