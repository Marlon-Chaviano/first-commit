/**
 * Creates a git tag "<kit>@<version>" for every official kit whose current
 * version isn't tagged yet. `create-first-commit init <kit>@<version>` downloads that tag.
 * Run on the main branch after merging a version bump (CI does it in phase 8):
 *   pnpm registry:tag && git push --tags
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "registry", "kits");
const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

try {
  git("rev-parse", "HEAD");
} catch {
  console.error("El repo todavía no tiene commits: no hay nada que etiquetar.");
  process.exit(1);
}

const existing = new Set(git("tag", "--list").split("\n"));
let created = 0;
for (const name of readdirSync(root).sort()) {
  const { version } = JSON.parse(readFileSync(join(root, name, "kit.json"), "utf8")) as { version: string };
  const tag = `${name}@${version}`;
  if (existing.has(tag)) continue;
  git("tag", "-a", tag, "-m", `${name} ${version}`);
  console.log(`✓ ${tag}`);
  created++;
}
console.log(created ? `${created} etiquetas nuevas. Súbelas con: git push --tags` : "Todas las versiones ya están etiquetadas.");
