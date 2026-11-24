import {
  LIBRARY_CATEGORIES,
  LIBRARY_KINDS,
  PACKAGE_MANAGERS,
  REGISTRY_RAW_BASE,
  libraryFits,
  type Catalog,
  type Kit,
  type Library,
  type LibraryKind,
  type McpServer,
  type PackageManager,
} from "./index";
import { detectFramework, isBaseline, projectLibraryTargets, type FrameworkMatch } from "./project-frameworks";

export { detectFramework, projectLibraryTargets } from "./project-frameworks";
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

/** Packages `shadcn init` adds; they come back when the kit runs it again. */
const SHADCN_INIT = [
  "shadcn",
  "cn",
  "clsx",
  "tailwind-merge",
  "class-variance-authority",
  "lucide-react",
  "tw-animate-css",
  "@base-ui/react",
  /^@radix-ui\//,
];
/** "tailwindcss@^3.4.17" → "tailwindcss", "@scope/pkg@1" → "@scope/pkg" */
export function packageName(spec: string): string {
  const at = spec.indexOf("@", 1);
  return at === -1 ? spec : spec.slice(0, at);
}

/** Every catalog library installed in the project, by kind (`doctor` needs all of them). */
export function matchInstalledLibraries(
  hasPath: (path: string) => boolean,
  componentsJson: { registries?: Record<string, unknown> } | null,
  catalog: Catalog,
  targets: string[],
  deps: Record<string, string>,
): Record<LibraryKind, Library[]> {
  const installed = (lib: Library) => {
    const pkgs = [...lib.dependencies, ...lib.devDependencies].map(packageName);
    if (pkgs.length) return pkgs.every((p) => p in deps);
    if (lib.id.startsWith("shadcn")) return componentsJson !== null;
    if (lib.kind === "addon") {
      return (
        Object.keys(componentsJson?.registries ?? {}).includes(`@${lib.id}`) ||
        ["src/components", "components"].some((d) => hasPath(d + "/" + lib.id))
      );
    }
    return false;
  };
  const found = (kind: Library["kind"]) => catalog.filter((l) => l.kind === kind && libraryFits(l, targets) && installed(l));
  return Object.fromEntries(LIBRARY_KINDS.map((kind) => [kind, found(kind)])) as Record<LibraryKind, Library[]>;
}

/** A library matches when all its packages are installed (shadcn-style registries: by components.json). */
function matchLibraries(
  hasPath: (path: string) => boolean,
  components: { registries?: Record<string, unknown> } | null,
  catalog: Catalog,
  framework: FrameworkMatch,
  deps: Record<string, string>,
): Detection["libraries"] {
  const all = matchInstalledLibraries(hasPath, components, catalog, projectLibraryTargets(framework), deps);
  return {
    components: framework.ui ? all.components[0] : undefined,
    addons: framework.ui ? all.addon : [],
    animation: framework.ui ? all.animation : [],
    observability: all.observability,
    // Auth, database, payments, testing… (categories that don't depend on a UI framework).
    others: LIBRARY_KINDS.filter((k) => !["components", "addon", "animation", "observability"].includes(k)).flatMap((k) => all[k]),
  };
}

export interface ProjectPackage {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export function inferProject(
  pkg: ProjectPackage,
  catalog: Catalog,
  hasPath: (path: string) => boolean,
  components: { registries?: Record<string, unknown> } | null,
  baseOverride?: string,
) {
  const deps = pkg.dependencies ?? {};
  const devDeps = pkg.devDependencies ?? {};
  const all = { ...deps, ...devDeps };

  const detected = detectFramework(all);
  const framework: FrameworkMatch | null = baseOverride
    ? {
        ...(detected ?? { id: "custom", label: "Custom project", category: "other", frameworks: [], ui: false, baseline: [] }),
        base: { command: baseOverride },
      }
    : detected;
  if (!framework) {
    throw new Error('Unrecognized framework (Next.js, Expo, Hono, WXT or Vite). Use --base "<command that creates the project>".');
  }

  const libraries = matchLibraries(hasPath, components, catalog, framework, all);
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

  return {
    packageName: pkg.name ?? "mi-kit",
    framework,
    libraries,
    dependencies: Object.keys(deps).filter(keep),
    devDependencies: Object.keys(devDeps).filter(keep),
  };
}

const KIT_BLOCK = /<!-- kits:start -->[\s\S]*?<!-- kits:end -->\n?/g;
const NEXT_BLOCK = /<!-- BEGIN:nextjs-agent-rules -->[\s\S]*?<!-- END:nextjs-agent-rules -->\n?/g;

/** Remove instructions supplied by kits and by the framework scaffolder. */
export function projectInstructions(content: string, framework: FrameworkMatch) {
  let text = content.replace(KIT_BLOCK, "").replace(NEXT_BLOCK, "");
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

interface Answers {
  name: string;
  title: string;
  description: string;
  category: Kit["category"];
  dependencies: string[];
  devDependencies: string[];
  skills: string[];
  mcpNames: string[];
  instructions?: string;
  hasFiles: boolean;
}

/** The kit.json as written to disk: only non-empty fields, in a readable order. */
export function buildKitJson(
  d: Pick<Detection, "framework" | "libraries" | "mcp" | "pm" | "env" | "githubRepo">,
  a: Answers,
): Record<string, unknown> {
  const { libraries: l, framework: f } = d;
  const libraries = f.ui
    ? {
        framework: f.frameworks,
        components: l.components?.id ?? "none",
        addons: l.addons.map((x) => x.id),
        animation: l.animation.map((x) => x.id),
        observability: l.observability.map((x) => x.id),
      }
    : { framework: f.frameworks, observability: l.observability.map((x) => x.id) };
  // Other detected categories (database, payments, testing…) become options too.
  for (const category of LIBRARY_CATEGORIES) {
    const found = l.others.filter((lib) => lib.kind === category.kind);
    if (found.length)
      (libraries as Record<string, unknown>)[category.key] = category.type === "select" ? found[0]!.id : found.map((x) => x.id);
  }
  const mcp = Object.fromEntries(a.mcpNames.map((n) => [n, d.mcp[n]]));

  const kit: Record<string, unknown> = {
    $schema: `${REGISTRY_RAW_BASE}/kit.schema.json`,
    name: a.name,
    version: "0.1.0",
    title: a.title,
    description: a.description,
    category: a.category,
    tags: f.frameworks,
    author: d.githubRepo?.split("/")[0] ?? "anonymous",
    base: f.base,
    ...(f.addCommand ? { addCommand: f.addCommand } : {}),
    // The creator's package manager becomes the default.
    packageManagers: [d.pm, ...PACKAGE_MANAGERS.filter((pm) => pm !== d.pm)],
    libraries: { ...libraries, ...(f.platforms?.length && { platforms: f.platforms }) },
  };
  if (a.dependencies.length) kit.dependencies = a.dependencies;
  if (a.devDependencies.length) kit.devDependencies = a.devDependencies;
  if (a.skills.length) kit.skills = a.skills;
  if (Object.keys(mcp).length) kit.mcp = mcp;
  if (Object.keys(d.env).length) kit.env = d.env;
  if (a.hasFiles) kit.files = "files";
  if (a.instructions) kit.instructions = a.instructions;
  return kit;
}

export function kitSlug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/^@[^/]+\//, "")
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "mi-kit"
  );
}
