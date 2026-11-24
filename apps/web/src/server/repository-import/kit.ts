import "server-only";

import { basename } from "node:path";
import { buildPlan, loadKitFrom, pmFromLockfiles, selectionsFrom, type Catalog, type McpServer } from "@kits/schema";
import { buildKitJson, inferProject, kitSlug, projectInstructions, type ProjectPackage } from "@kits/schema/project";
import { strToU8, zipSync } from "fflate";
import { z } from "zod";

import { fail } from "../errors";
import { kitSource } from "../registry";
import type { Snapshot, Source } from "./github";

const packageName = /^(?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i;
const packages = z.record(z.string().regex(packageName), z.string()).default({});
const manifest = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  dependencies: packages,
  devDependencies: packages,
});
const skillRef = /^[\w.-]+\/[\w.-]+@[\w.:-]+$/;
const optionalFile = /^(?:(?:src|app|components|lib)\/[\w/@()+.[\]-]+\.(?:[cm]?[jt]sx?|css|scss|mdx?)|(?:biome|components)\.json)$/;
const sensitive = /(?:^|[\/._-])(?:secrets?|credentials?|passwords?|private[-_]?key|tokens?)(?:[\/._-]|$)/i;

async function json(snapshot: Snapshot, path: string) {
  if (!snapshot.paths.includes(path)) return null;
  const bytes = await snapshot.read(path);
  try {
    return JSON.parse(bytes.toString());
  } catch {
    return fail("Invalid JSON in " + path + ". Fix the file or select another folder.");
  }
}

export async function detectRepositoryKit(snapshot: Snapshot, source: Source, catalog: Catalog) {
  if (!snapshot.paths.includes("package.json")) fail("Choose the project folder containing package.json.");
  const parsed = manifest.safeParse(await json(snapshot, "package.json"));
  if (!parsed.success) fail("Check the names and versions in package.json, then try again.");
  const pkg = parsed.data;
  // Workspace and filesystem dependencies need other packages that a standalone scaffold does not contain.
  const external = (items: Record<string, string>) =>
    Object.fromEntries(Object.entries(items).filter(([, version]) => !/^(?:workspace:|link:|file:|portal:|\.\/|\.\.\/)/.test(version)));
  const standalone: ProjectPackage = { ...pkg, dependencies: external(pkg.dependencies), devDependencies: external(pkg.devDependencies) };
  const omittedLocal = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter(
    (key) => !(key in standalone.dependencies!) && !(key in standalone.devDependencies!),
  );
  const components = await json(snapshot, "components.json");
  let inferred: ReturnType<typeof inferProject>;
  try {
    inferred = inferProject(standalone, catalog, (p) => snapshot.paths.some((f) => f === p || f.startsWith(p + "/")), components);
  } catch {
    return fail("Choose a Next.js, Expo, Hono, WXT or Vite project folder. For a custom scaffold, use the CLI with --base.");
  }
  const lock = await json(snapshot, "skills-lock.json");
  const skills = Object.entries(lock?.skills ?? {})
    .map(([name, value]) => String((value as { source?: string } | null)?.source) + "@" + name)
    .filter((s) => skillRef.test(s));
  // Import known public definitions from the catalog. Repository arguments, headers and environment values can contain credentials.
  const knownMcp = catalog.flatMap((lib) => Object.values(lib.mcp));
  const mcp: Record<string, McpServer> = Object.create(null);
  const omittedMcp = new Set<string>();
  for (const path of [".mcp.json", ".cursor/mcp.json"]) {
    const config = await json(snapshot, path);
    for (const [name, value] of Object.entries(config?.mcpServers ?? {})) {
      const server = value as Partial<{ url: string; command: string; args: string[] }> | null;
      const safe = knownMcp.find(
        (s) =>
          server &&
          ("url" in s
            ? s.url === server.url
            : s.command === server.command && JSON.stringify(s.args) === JSON.stringify(server.args ?? [])),
      );
      if (safe && /^[\w-]+$/.test(name) && !["__proto__", "constructor", "prototype"].includes(name)) mcp[name] = safe;
      else omittedMcp.add(name);
    }
  }
  const localLocks = snapshot.paths.filter((p) =>
    ["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lock", "bun.lockb"].includes(p),
  );
  const pm = pmFromLockfiles((p) => (localLocks.length ? localLocks : snapshot.inheritedLocks).includes(p));
  const eligible = snapshot.paths.filter((p) => optionalFile.test(p) && !sensitive.test(p) && snapshot.readable(p));
  const name = kitSlug(pkg.name ?? (basename(source.folder) || source.repo.split("/")[1]!));
  const catalogLibraries = Object.values(inferred.libraries)
    .flat()
    .filter((l) => !!l);
  const review = {
    name,
    title: name,
    description: pkg.description?.slice(0, 300) || inferred.framework.label + " starter",
    framework: inferred.framework.label,
    pm,
    dependencies: inferred.dependencies,
    devDependencies: inferred.devDependencies,
    skills,
    servers: Object.keys(mcp),
    libraries: catalogLibraries.map((l) => l.id),
    libraryNames: Object.fromEntries(catalogLibraries.map((l) => [l.id, l.name])),
    files: eligible.slice(0, 200),
    instructions: snapshot.readable("AGENTS.md"),
    partial: snapshot.partial || eligible.length > 200,
    omitted: [...omittedLocal, ...omittedMcp],
  };
  return { review, inferred, mcp };
}

export interface KitChoices {
  name: string;
  title: string;
  description: string;
  libraries: string[];
  dependencies: string[];
  devDependencies: string[];
  skills: string[];
  servers: string[];
  files: string[];
  instructions: boolean;
}
export async function prepareRepositoryKit(snapshot: Snapshot, source: Source, catalog: Catalog, choices: KitChoices) {
  const { review, inferred, mcp } = await detectRepositoryKit(snapshot, source, catalog);
  const { name, title, description } = choices;
  if (!/^[a-z0-9-]{1,80}$/.test(name) || !title.trim() || !description.trim()) fail("Enter a kit identifier, title and description.");
  for (const key of ["libraries", "dependencies", "devDependencies", "skills", "servers", "files"] as const) {
    if (!Array.isArray(choices[key]) || choices[key].some((v) => !review[key].includes(v)))
      fail("The selection changed. Review the repository again.");
  }
  if (choices.files.length > 10) fail("Select up to ten project files.");
  const instructions =
    choices.instructions && review.instructions
      ? projectInstructions((await snapshot.read("AGENTS.md")).toString(), inferred.framework)
      : undefined;
  const detected = inferred.libraries;
  const include = (lib: { id: string }) => choices.libraries.includes(lib.id);
  const libraries = {
    components: detected.components && include(detected.components) ? detected.components : undefined,
    addons: detected.addons.filter(include),
    animation: detected.animation.filter(include),
    observability: detected.observability.filter(include),
    others: detected.others.filter(include),
  };
  const raw = buildKitJson(
    { framework: inferred.framework, libraries, pm: review.pm, mcp, githubRepo: source.repo, env: {} },
    {
      name,
      title,
      description,
      category: inferred.framework.category,
      dependencies: choices.dependencies,
      devDependencies: choices.devDependencies,
      skills: choices.skills,
      mcpNames: choices.servers,
      hasFiles: choices.files.length > 0,
      instructions,
    },
  );
  try {
    const kit = await loadKitFrom({ raw, dir: "kit" }, { ...kitSource, catalog: async () => catalog }, { admit: true });
    const steps = buildPlan({ kit, kitDir: "kit", sel: selectionsFrom(kit, {}).selections, parentDir: ".", name: "my-project", git: true });
    const content = JSON.stringify(raw, null, 2) + "\n";
    const files: Record<string, Uint8Array> = { "kit/kit.json": strToU8(content) };
    for (const file of choices.files) files["kit/files/" + file] = await snapshot.read(file);
    return {
      content,
      plan: steps.map((s) => (s.kind === "run" ? s.command : s.title)),
      zip: Buffer.from(zipSync(files)).toString("base64"),
    };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Check the selection and try again.");
  }
}
