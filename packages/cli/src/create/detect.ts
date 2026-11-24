import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { BRAND, pmFromLockfiles, type Catalog, type LibraryKind, type Library, type McpServer, type PackageManager } from "@kits/schema";
import { inferProject, projectInstructions, matchInstalledLibraries, type Detection, type ProjectPackage } from "@kits/schema/project";
export { packageName, type Detection } from "@kits/schema/project";

const NEVER_SHIP = new Set([
  "package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb", "pnpm-workspace.yaml",
  "AGENTS.md", "CLAUDE.md", "GEMINI.md", "README.md", "LICENSE", ".gitignore", ".mcp.json", "skills-lock.json",
  "kits.lock", "tsconfig.json", "next-env.d.ts", "components.json", "app.json", "kit.json",
]);
const NEVER_SHIP_DIRS = ["node_modules", ".git", ".next", "dist", "build", ".expo", ".output", ".wxt", ".turbo", ".vercel",
  ".claude", ".agents", ".cursor", ".codex", ".gemini", ".vscode", "kit", "ios", "android", "drizzle"];
const SOURCE_ROOTS = new Set(["src", "app", "lib", "components"]);

/** `baseOverride`: the scaffold command, for frameworks kits doesn't recognize. */
export async function detectProject(dir: string, catalog: Catalog, baseOverride?: string): Promise<Detection> {
  const pkgPath = join(dir, "package.json");
  if (!existsSync(pkgPath)) throw new Error(`No package.json in ${dir}. ${BRAND.cli} create needs a JavaScript/TypeScript project.`);
  const pkg = JSON.parse(await readFile(pkgPath, "utf8")) as ProjectPackage;
  const inferred = inferProject(pkg, catalog, (path) => existsSync(join(dir, path)), readComponents(dir), baseOverride);
  const { framework, libraries } = inferred;
  const { skills, unknownSkills } = await readSkills(dir);
  const libWrites = new Set(
    [libraries.components, ...libraries.addons, ...libraries.animation, ...libraries.observability, ...libraries.others].flatMap((l) =>
      l ? l.writeFiles.map((f) => f.path) : [],
    ),
  );

  return {
    ...inferred,
    pm: detectPm(dir),
    skills,
    unknownSkills,
    mcp: await readMcp(dir),
    instructions: await readInstructions(dir, framework),
    env: await readEnv(dir),
    fileGroups: groupFiles(listFiles(dir).filter((f) => !libWrites.has(f))),
    githubRepo: gitRemote(dir),
  };
}

function readComponents(dir: string) {
  return readJson(join(dir, "components.json")) as { registries?: Record<string, unknown> } | null;
}

export function installedLibraries(dir: string, catalog: Catalog, targets: string[], deps: Record<string, string>): Record<LibraryKind, Library[]> {
  return matchInstalledLibraries((path) => existsSync(join(dir, path)), readComponents(dir), catalog, targets, deps);
}

/** Dependencies of the project at `dir` (empty when there's no package.json). */
export function readDeps(dir: string): Record<string, string> {
  const pkg = readJson(join(dir, "package.json")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } | null;
  return { ...pkg?.dependencies, ...pkg?.devDependencies };
}

async function readSkills(dir: string): Promise<{ skills: string[]; unknownSkills: string[] }> {
  const lock = readJson(join(dir, "skills-lock.json")) as { skills?: Record<string, { source?: string }> } | null;
  const skills = Object.entries(lock?.skills ?? {})
    .filter(([, s]) => s.source)
    .map(([name, s]) => `${s.source}@${name}`);
  const known = new Set(Object.keys(lock?.skills ?? {}));
  const folders = [".agents/skills", ".claude/skills"].flatMap((d) => (existsSync(join(dir, d)) ? readdirSync(join(dir, d)) : []));
  return { skills, unknownSkills: [...new Set(folders)].filter((f) => !known.has(f) && !f.startsWith(".")) };
}

async function readMcp(dir: string): Promise<Record<string, McpServer>> {
  const out: Record<string, McpServer> = {};
  for (const file of [".mcp.json", ".cursor/mcp.json"]) {
    const data = readJson(join(dir, file)) as { mcpServers?: Record<string, Record<string, unknown>> } | null;
    for (const [name, s] of Object.entries(data?.mcpServers ?? {})) {
      if (out[name]) continue;
      if (typeof s.url === "string") {
        out[name] = { url: s.url, ...(s.headers ? { headers: s.headers as Record<string, string> } : {}) };
      } else if (typeof s.command === "string") {
        out[name] = {
          command: s.command,
          args: Array.isArray(s.args) ? (s.args as string[]) : [],
          ...(s.env ? { env: s.env as Record<string, string> } : {}),
        };
      }
    }
  }
  return out;
}

/** The project's own AGENTS.md, without what kits or the scaffolder generate. */
async function readInstructions(dir: string, framework: Detection["framework"]): Promise<string | undefined> {
  const path = join(dir, "AGENTS.md");
  if (!existsSync(path)) return undefined;
  return projectInstructions(await readFile(path, "utf8"), framework);
}

/** .env.example only: real .env files may hold secrets. */
async function readEnv(dir: string): Promise<Record<string, string>> {
  const path = join(dir, ".env.example");
  if (!existsSync(path)) return {};
  const env: Record<string, string> = {};
  for (const line of (await readFile(path, "utf8")).split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

/** Tracked files (git) or a filtered walk, minus what a kit never ships. */
function listFiles(dir: string): string[] {
  let files: string[];
  try {
    files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .split("\n")
      .filter(Boolean);
  } catch {
    files = walk(dir, dir);
  }
  return files.filter((f) => {
    const first = f.split("/")[0]!;
    return !NEVER_SHIP.has(f) && !f.startsWith(".env") && !NEVER_SHIP_DIRS.includes(first) && !f.includes("/node_modules/");
  });
}

function walk(root: string, dir: string, depth = 0): string[] {
  if (depth > 6) return [];
  return readdirSync(dir).flatMap((name) => {
    if (NEVER_SHIP_DIRS.includes(name)) return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(root, path, depth + 1) : [relative(root, path)];
  });
}

/** "src/lib/a.ts", "src/lib/b.ts", "biome.json" → [{ src/lib: 2 files }, { biome.json }] */
function groupFiles(files: string[]): Detection["fileGroups"] {
  const groups = new Map<string, string[]>();
  for (const f of files) {
    const parts = f.split("/");
    const key = parts.length === 1 ? f : SOURCE_ROOTS.has(parts[0]!) && parts.length > 2 ? parts.slice(0, 2).join("/") : parts[0]!;
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }
  return [...groups].map(([path, files]) => ({ path, files })).sort((a, b) => a.path.localeCompare(b.path));
}

export function detectPm(dir: string): PackageManager {
  return pmFromLockfiles((file) => existsSync(join(dir, file)));
}

function gitRemote(dir: string): string | undefined {
  try {
    const url = execFileSync("git", ["remote", "get-url", "origin"], { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return url.match(/github\.com[:/]([\w.-]+\/[\w.-]+?)(?:\.git)?$/)?.[1];
  } catch {
    return undefined;
  }
}

function readJson(path: string): unknown {
  try {
    return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
  } catch {
    return null;
  }
}
