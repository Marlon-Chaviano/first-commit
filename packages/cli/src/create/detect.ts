import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { LIBRARY_KINDS, type Catalog, type Library, type LibraryKind, type McpServer, type PackageManager } from "@kits/schema";

import { detectFramework, isBaseline, type FrameworkMatch } from "./frameworks";

export interface Detection {
  packageName: string;
  pm: PackageManager;
  framework: FrameworkMatch;
  libraries: { components?: Library; addons: Library[]; animation: Library[]; observability: Library[]; others: Library[] };
  dependencies: string[];
  devDependencies: string[];
  skills: string[];
  /** Skill folders found without a source repo (not in skills-lock.json). */
  unknownSkills: string[];
  mcp: Record<string, McpServer>;
  instructions?: string;
  env: Record<string, string>;
  /** Candidate files/folders to ship in the kit, grouped (e.g. "src/lib"). */
  fileGroups: { path: string; files: string[] }[];
  /** "owner/repo" from the git remote, for the install command. */
  githubRepo?: string;
}

const KIT_BLOCK = /<!-- kits:start -->[\s\S]*?<!-- kits:end -->\n?/g;
const NEXT_BLOCK = /<!-- BEGIN:nextjs-agent-rules -->[\s\S]*?<!-- END:nextjs-agent-rules -->\n?/g;
/** Packages `shadcn init` adds; they come back when the kit runs it again. */
const SHADCN_INIT = ["shadcn", "cn", "clsx", "tailwind-merge", "class-variance-authority", "lucide-react", "tw-animate-css", "@base-ui/react", /^@radix-ui\//];
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
  if (!existsSync(pkgPath)) throw new Error(`No hay package.json en ${dir}. create-first-commit create necesita un proyecto JavaScript/TypeScript.`);
  const pkg = JSON.parse(await readFile(pkgPath, "utf8")) as {
    name?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const deps = pkg.dependencies ?? {};
  const devDeps = pkg.devDependencies ?? {};
  const all = { ...deps, ...devDeps };

  const detected = detectFramework(all);
  const framework: FrameworkMatch | null = baseOverride
    ? {
        ...(detected ?? { id: "custom", label: "Proyecto propio", category: "other", frameworks: [], ui: false, baseline: [] }),
        base: { command: baseOverride },
      }
    : detected;
  if (!framework) {
    throw new Error("No reconozco el framework (Next.js, Expo, Hono, WXT o Vite). Usa --base \"<comando que crea el proyecto>\".");
  }

  const libraries = matchLibraries(dir, catalog, framework, all);
  const covered = new Set<string>();
  for (const lib of [libraries.components, ...libraries.addons, ...libraries.animation, ...libraries.observability, ...libraries.others]) {
    if (!lib) continue;
    for (const d of [...lib.dependencies, ...lib.devDependencies]) covered.add(packageName(d));
  }
  const usesShadcn = libraries.components?.id === "shadcn";
  const keep = (name: string) =>
    !isBaseline(framework, name) &&
    !covered.has(name) &&
    !(usesShadcn && SHADCN_INIT.some((p) => (typeof p === "string" ? p === name : p.test(name))));

  const { skills, unknownSkills } = await readSkills(dir);
  const libWrites = new Set(
    [libraries.components, ...libraries.addons, ...libraries.animation, ...libraries.observability, ...libraries.others].flatMap((l) =>
      l ? l.writeFiles.map((f) => f.path) : [],
    ),
  );

  return {
    packageName: pkg.name ?? "mi-kit",
    pm: detectPm(dir),
    framework,
    libraries,
    dependencies: Object.keys(deps).filter(keep),
    devDependencies: Object.keys(devDeps).filter(keep),
    skills,
    unknownSkills,
    mcp: await readMcp(dir),
    instructions: await readInstructions(dir, framework),
    env: await readEnv(dir),
    fileGroups: groupFiles(listFiles(dir).filter((f) => !libWrites.has(f))),
    githubRepo: gitRemote(dir),
  };
}

/** Every catalog library installed in the project, by kind (`doctor` needs all of them). */
export function installedLibraries(
  dir: string,
  catalog: Catalog,
  frameworks: string[],
  deps: Record<string, string>,
): Record<LibraryKind, Library[]> {
  const fits = (lib: Library) => lib.frameworks.some((f) => frameworks.includes(f));
  const componentsJson = readJson(join(dir, "components.json")) as { registries?: Record<string, unknown> } | null;
  const installed = (lib: Library) => {
    const pkgs = [...lib.dependencies, ...lib.devDependencies].map(packageName);
    if (pkgs.length) return pkgs.every((p) => p in deps);
    if (lib.id.startsWith("shadcn")) return componentsJson !== null;
    if (lib.kind === "addon") {
      return (
        Object.keys(componentsJson?.registries ?? {}).includes(`@${lib.id}`) ||
        ["src/components", "components"].some((d) => existsSync(join(dir, d, lib.id)))
      );
    }
    return false;
  };
  const found = (kind: Library["kind"]) => catalog.filter((l) => l.kind === kind && fits(l) && installed(l));
  return Object.fromEntries(LIBRARY_KINDS.map((kind) => [kind, found(kind)])) as Record<LibraryKind, Library[]>;
}

/** A library matches when all its packages are installed (shadcn-style registries: by components.json). */
function matchLibraries(dir: string, catalog: Catalog, framework: FrameworkMatch, deps: Record<string, string>): Detection["libraries"] {
  const all = installedLibraries(dir, catalog, framework.frameworks, deps);
  return {
    components: framework.ui ? all.components[0] : undefined,
    addons: framework.ui ? all.addon : [],
    animation: framework.ui ? all.animation : [],
    observability: all.observability,
    // Auth, database, payments, testing… (categories that don't depend on a UI framework).
    others: LIBRARY_KINDS.filter((k) => !["components", "addon", "animation", "observability"].includes(k)).flatMap((k) => all[k]),
  };
}

/** Dependencies of the project at `dir` (empty when there's no package.json). */
export function readDeps(dir: string): Record<string, string> {
  const pkg = readJson(join(dir, "package.json")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } | null;
  return { ...pkg?.dependencies, ...pkg?.devDependencies };
}

/** "tailwindcss@^3.4.17" → "tailwindcss", "@scope/pkg@1" → "@scope/pkg" */
export function packageName(spec: string): string {
  const at = spec.indexOf("@", 1);
  return at === -1 ? spec : spec.slice(0, at);
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
async function readInstructions(dir: string, framework: FrameworkMatch): Promise<string | undefined> {
  const path = join(dir, "AGENTS.md");
  if (!existsSync(path)) return undefined;
  let text = (await readFile(path, "utf8")).replace(KIT_BLOCK, "").replace(NEXT_BLOCK, "");
  if (framework.templateHeadings) {
    const sections = text.split(/^(?=## )/m);
    // The preamble before the first "## " is the scaffolder's intro too.
    text = sections
      .slice(1)
      .filter((s) => !framework.templateHeadings!.some((h) => s.startsWith(`## ${h}`)))
      .join("");
  }
  text = text.replace(/^# .*\n/, "").trim();
  return text || undefined;
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
  if (existsSync(join(dir, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(dir, "bun.lock")) || existsSync(join(dir, "bun.lockb"))) return "bun";
  return "npm";
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
