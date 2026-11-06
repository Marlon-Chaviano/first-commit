import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { splitKitRef } from "../extends";
import { catalogSchema } from "../libraries";
import { isOfficialKitName, loadKitFrom, type KitSource } from "../load";
import type { Kit } from "../schema";

/**
 * A registry folder (`registry/` with `kits/<name>/kit.json` and `libraries.json`)
 * as a KitSource. Parents in `extends` must be official kits of the same folder,
 * so the registry stays self-contained.
 */
export function registrySource(registryDir: string): KitSource {
  let catalog: ReturnType<KitSource["catalog"]> | undefined;
  return {
    async read(ref) {
      const name = splitKitRef(ref).base;
      const dir = join(registryDir, "kits", name);
      if (!isOfficialKitName(name) || !existsSync(join(dir, "kit.json"))) {
        throw new Error(`"extends" must point to another official kit, not to "${ref}"`);
      }
      return { raw: JSON.parse(await readFile(join(dir, "kit.json"), "utf8")) as Record<string, unknown>, dir };
    },
    catalog: () => (catalog ??= readFile(join(registryDir, "libraries.json"), "utf8").then((text) => catalogSchema.parse(JSON.parse(text)))),
    resolvePath: resolve,
  };
}

/** Every kit of a registry folder, as the CLI and the website load them (for tests and tools). */
export async function loadRegistryKits(registryDir: string): Promise<Kit[]> {
  const source = registrySource(registryDir);
  const names = readdirSync(join(registryDir, "kits")).sort();
  return Promise.all(names.map(async (name) => loadKitFrom(await source.read(name), source)));
}
