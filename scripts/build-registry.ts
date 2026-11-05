/**
 * Validates every kit in registry/kits and writes:
 *   registry/index.json       — listing used by `create-first-commit list` and the website
 *   registry/kit.schema.json  — JSON Schema for editor autocompletion in kit.json
 *
 * With --check-skills it also asks the skills CLI whether every referenced
 * skill still exists (search indexes can list skills a repo has since removed).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  allKitSkills,
  BRAND,
  kitLanguage,
  catalogSchema,
  defaultSelections,
  expandKit,
  kitSchema,
  parseKit,
  resolveExtends,
  splitKitRef,
  stackSelections,
  stacksSchema,
  type Kit,
  testCombinations,
  validateSelections,
  type RegistryEntry,
} from "@kits/schema";
import { z } from "zod";

import { hashKitDir, type IntegrityMap } from "@kits/schema/node";
import { checkSkills } from "../packages/cli/src/skills-check";

const root = join(import.meta.dirname, "..", "registry");
const entries: RegistryEntry[] = [];
const expanded = new Map<string, Kit>();
const refs = new Set<string>();

const catalog = catalogSchema.parse(JSON.parse(readFileSync(join(root, "libraries.json"), "utf8")));
for (const lib of catalog) for (const ref of lib.skills) refs.add(ref);

const kitDir = (name: string) => join(root, "kits", name);
const integrityPath = join(root, "integrity.json");
const integrity: IntegrityMap = existsSync(integrityPath) ? JSON.parse(readFileSync(integrityPath, "utf8")) : {};

/** A version is published once its git tag exists (see scripts/tag-registry.ts). */
function isPublished(tag: string): boolean {
  try {
    return execFileSync("git", ["tag", "--list", tag], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() === tag;
  } catch {
    return false;
  }
}
const readRaw = (name: string) => JSON.parse(readFileSync(join(kitDir(name), "kit.json"), "utf8")) as Record<string, unknown>;

for (const name of readdirSync(join(root, "kits")).sort()) {
  const raw = readRaw(name);
  const merged = await resolveExtends({ raw, dir: kitDir(name) }, async (ref) => {
    // Official kits may only extend official kits, so the registry stays self-contained.
    const parent = splitKitRef(ref).base;
    if (!/^[a-z0-9-]+$/.test(parent) || !existsSync(kitDir(parent))) {
      throw new Error(`registry/kits/${name}: "extends" debe apuntar a otro kit oficial, no a "${ref}"`);
    }
    return { raw: readRaw(parent), dir: kitDir(parent) };
  }, resolve);
  const kit = expandKit(parseKit(merged), catalog);
  expanded.set(name, kit);
  try {
    // Defaults must form a valid combination (requirements included).
    validateSelections(kit, defaultSelections(kit));
    // Every `verify.matrix` entry must be a valid combination too.
    testCombinations(kit);
  } catch (error) {
    throw new Error(`registry/kits/${name}: ${(error as Error).message}`);
  }
  if (kit.name !== name) throw new Error(`registry/kits/${name}: kit.json name is "${kit.name}"`);
  for (const ref of allKitSkills(kit)) refs.add(ref);
  // Published versions are immutable: changing their files requires a version bump.
  const hash = hashKitDir(kitDir(name));
  const recorded = integrity[name]?.[kit.version];
  if (recorded && recorded !== hash && isPublished(`${name}@${kit.version}`)) {
    throw new Error(`registry/kits/${name}: la versión ${kit.version} ya está publicada y sus archivos cambiaron. Sube "version".`);
  }
  integrity[name] = { ...integrity[name], [kit.version]: hash };

  entries.push({
    name: kit.name,
    version: kit.version,
    ...(typeof raw.extends === "string" ? { extends: raw.extends } : {}),
    title: kit.title,
    description: kit.description,
    category: kit.category,
    tags: kit.tags,
    author: kit.author,
    skills: allKitSkills(kit).length,
    options: kit.options.map((o) => o.label),
    language: kitLanguage(kit),
    libraries: [...new Set(kit.options.flatMap((o) => o.choices).flatMap((c) => catalog.filter((l) => l.id === c.id).map((l) => l.name)))],
  });
}

writeFileSync(join(root, "index.json"), JSON.stringify(entries, null, 2) + "\n");

// Curated stacks: each one must be a valid combination of an official kit.
const stacks = stacksSchema.parse(JSON.parse(readFileSync(join(root, "stacks.json"), "utf8")));
for (const stack of stacks) {
  const kit = expanded.get(stack.kit);
  if (!kit) throw new Error(`registry/stacks.json: "${stack.slug}" usa el kit "${stack.kit}", que no existe`);
  try {
    stackSelections(kit, stack.options);
  } catch (error) {
    throw new Error(`registry/stacks.json: "${stack.slug}": ${(error as Error).message}`);
  }
}

// The kits skill (skills/kits) uses the provisional brand, so it's generated too.
const skill = readFileSync(join(root, "..", "scripts", "skill-template.md"), "utf8").replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
  const value = (BRAND as Record<string, string>)[key];
  if (value === undefined) throw new Error(`skill-template.md: {{${key}}} no existe en BRAND`);
  return value;
});
writeFileSync(join(root, "..", "skills", BRAND.name, "SKILL.md"), skill);
writeFileSync(integrityPath, JSON.stringify(integrity, null, 2) + "\n");
writeFileSync(join(root, "kit.schema.json"), JSON.stringify(z.toJSONSchema(kitSchema, { io: "input" }), null, 2) + "\n");
console.log(`✓ ${entries.length} kits y ${catalog.length} bibliotecas válidos → registry/index.json`);

if (process.argv.includes("--check-skills")) {
  const { missing } = checkSkills(refs, (source, ok) => console.log(`${ok ? "✓" : "✗"} ${source}`));
  if (missing.length) {
    console.error(`\nSkills que no existen:\n${missing.map((m) => `  - ${m}`).join("\n")}`);
    process.exit(1);
  }
  console.log(`✓ ${refs.size} skills verificados`);
}
