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
import { join } from "node:path";

import {
  allKitSkills,
  BRAND,
  kitLanguage,
  catalogSchema,
  kitSchema,
  loadKitFrom,
  stackSelections,
  stacksSchema,
  type Kit,
  type RegistryEntry,
} from "@kits/schema";
import { z } from "zod";

import { hashKitDir, registrySource, type IntegrityMap } from "@kits/schema/node";
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

// Official kits may only extend official kits of this folder, so the registry stays self-contained.
const source = registrySource(root);

for (const name of readdirSync(join(root, "kits")).sort()) {
  const raw = readRaw(name);
  let kit: Kit;
  try {
    // Admitted like publishing: defaults and every `verify.matrix` entry are valid combinations.
    kit = await loadKitFrom({ raw, dir: kitDir(name) }, source, { admit: true });
  } catch (error) {
    throw new Error(`registry/kits/${name}: ${(error as Error).message}`);
  }
  expanded.set(name, kit);
  if (kit.name !== name) throw new Error(`registry/kits/${name}: kit.json name is "${kit.name}"`);
  for (const ref of allKitSkills(kit)) refs.add(ref);
  // Published versions are immutable: changing their files requires a version bump.
  const hash = hashKitDir(kitDir(name));
  const recorded = integrity[name]?.[kit.version];
  if (recorded && recorded !== hash && isPublished(`${name}@${kit.version}`)) {
    throw new Error(`registry/kits/${name}: version ${kit.version} is already published and its files changed. Bump "version".`);
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
  if (!kit) throw new Error(`registry/stacks.json: "${stack.slug}" uses the "${stack.kit}" kit, which doesn't exist`);
  try {
    stackSelections(kit, stack.options);
  } catch (error) {
    throw new Error(`registry/stacks.json: "${stack.slug}": ${(error as Error).message}`);
  }
}

// The kits skill (skills/kits) uses the provisional brand, so it's generated too.
const skill = readFileSync(join(root, "..", "scripts", "skill-template.md"), "utf8").replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
  const value = (BRAND as Record<string, string>)[key];
  if (value === undefined) throw new Error(`skill-template.md: {{${key}}} doesn't exist in BRAND`);
  return value;
});
writeFileSync(join(root, "..", "skills", BRAND.name, "SKILL.md"), skill);
writeFileSync(integrityPath, JSON.stringify(integrity, null, 2) + "\n");
writeFileSync(join(root, "kit.schema.json"), JSON.stringify(z.toJSONSchema(kitSchema, { io: "input" }), null, 2) + "\n");
console.log(`✓ ${entries.length} kits and ${catalog.length} libraries valid → registry/index.json`);

if (process.argv.includes("--check-skills")) {
  const { missing } = checkSkills(refs, (source, ok) => console.log(`${ok ? "✓" : "✗"} ${source}`));
  if (missing.length) {
    console.error(`\nSkills that don't exist:\n${missing.map((m) => `  - ${m}`).join("\n")}`);
    process.exit(1);
  }
  console.log(`✓ ${refs.size} skills verificados`);
}
