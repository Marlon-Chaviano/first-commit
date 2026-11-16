import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import { kitsLockSchema, LOCK_FILE, splitKitRef, type KitsLock, type Resolved, type Selections } from "@kits/schema";

export const hashFile = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

export async function readLock(projectDir: string): Promise<KitsLock | null> {
  const path = join(projectDir, LOCK_FILE);
  if (!existsSync(path)) {
    let parent = dirname(projectDir);
    while (parent !== dirname(parent)) {
      if (existsSync(join(parent, LOCK_FILE))) {
        const root = await readLock(parent);
        return Object.values(root?.services ?? {}).find((service) => resolve(parent, service.path) === resolve(projectDir)) ?? null;
      }
      parent = dirname(parent);
    }
    return null;
  }
  const parsed = kitsLockSchema.safeParse(JSON.parse(await readFile(path, "utf8")));
  if (!parsed.success) throw new Error(`${LOCK_FILE} isn't valid: ${parsed.error.issues[0]?.message}`);
  return parsed.data;
}

export async function writeLock(projectDir: string, lock: KitsLock): Promise<void> {
  if (!existsSync(join(projectDir, LOCK_FILE))) {
    let parent = dirname(projectDir);
    while (parent !== dirname(parent)) {
      if (existsSync(join(parent, LOCK_FILE))) {
        const root = await readLock(parent);
        const entry = Object.entries(root?.services ?? {}).find(([, service]) => resolve(parent, service.path) === resolve(projectDir));
        if (root && entry) {
          const { services: _services, ...child } = lock;
          await writeLock(parent, { ...root, services: { ...root.services, [entry[0]]: { ...child, lockVersion: 1, path: entry[1].path } } });
          return;
        }
        break;
      }
      parent = dirname(parent);
    }
  }
  await writeFile(join(projectDir, LOCK_FILE), JSON.stringify({ ...lock, updatedAt: new Date().toISOString() }, null, 2) + "\n");
}

/**
 * Files the kit owns: those it creates (`writeFiles` with mode "create") and
 * those it copies (`files`). Patches to the user's own files aren't managed.
 */
export function managedFiles(projectDir: string, kitDir: string, r: Resolved): Record<string, string> {
  const paths = new Set(r.writeFiles.filter((f) => f.mode === "create").map((f) => f.path));
  for (const dir of r.files) {
    const source = resolve(kitDir, dir);
    if (existsSync(source)) for (const file of walk(source)) paths.add(relative(source, file).split("\\").join("/"));
  }
  const out: Record<string, string> = {};
  for (const path of [...paths].sort()) {
    const full = join(projectDir, path);
    if (existsSync(full)) out[path] = hashFile(full);
  }
  for (const service of r.services ?? []) {
    for (const [path, hash] of Object.entries(managedFiles(join(projectDir, service.path), kitDir, service.resolved))) out[`${service.path}/${path}`] = hash;
  }
  return out;
}

export function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === ".DS_Store" || name === "node_modules") return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** Local kits are stored as absolute paths, so `update` works from the project folder. */
export function lockKitRef(ref: string): string {
  const { base } = splitKitRef(ref);
  return base.startsWith(".") || isAbsolute(base) ? resolve(base) : base;
}

export function newLock(o: {
  kit: string | null;
  version: string | null;
  registry?: string;
  sel: Selections;
  r: Resolved;
  managed: Record<string, string>;
  brand?: KitsLock["brand"];
}): KitsLock {
  return {
    lockVersion: o.r.services ? 2 : 1,
    ...(o.r.services ? { services: Object.fromEntries(o.r.services.map((service) => {
      const managed = Object.fromEntries(Object.entries(o.managed).filter(([path]) => path.startsWith(service.path + "/")).map(([path, hash]) => [path.slice(service.path.length + 1), hash]));
      const child = newLock({ kit: service.kit.name, version: service.kit.version, registry: o.registry, sel: service.sel, r: service.resolved, managed });
      return [service.id, { ...child, workspaceService: true, ...(service.embedded ? { embedded: true } : {}), lockVersion: 1 as const, path: service.path }];
    })) } : {}),
    kit: o.kit,
    version: o.version,
    registry: o.registry,
    options: o.sel.options,
    skills: o.r.skills,
    agents: o.sel.agents,
    pm: o.sel.pm,
    dependencies: o.r.dependencies,
    devDependencies: o.r.devDependencies,
    added: [],
    addedSkills: [],
    managedFiles: o.managed,
    brand: o.brand ?? null,
    updatedAt: new Date().toISOString(),
  };
}
