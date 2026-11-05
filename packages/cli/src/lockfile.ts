import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

import { kitsLockSchema, LOCK_FILE, splitKitRef, type KitsLock, type Resolved, type Selections } from "@kits/schema";

export const hashFile = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

export async function readLock(projectDir: string): Promise<KitsLock | null> {
  const path = join(projectDir, LOCK_FILE);
  if (!existsSync(path)) return null;
  const parsed = kitsLockSchema.safeParse(JSON.parse(await readFile(path, "utf8")));
  if (!parsed.success) throw new Error(`${LOCK_FILE} no es válido: ${parsed.error.issues[0]?.message}`);
  return parsed.data;
}

export async function writeLock(projectDir: string, lock: KitsLock): Promise<void> {
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
    lockVersion: 1,
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
