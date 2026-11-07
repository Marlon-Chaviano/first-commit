import { existsSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import * as p from "@clack/prompts";
import { applyWrite, BRAND, dependencySteps, FRAMEWORK_LABELS, importAgentsMd, INSTRUCTION_STUBS, libraryRule, mcpSteps, mergeEnv, skillRefSchema, skillSteps, templateVars, upsertBlock, type KitsLock, type Library, type Step, slugify } from "@kits/schema";
import pc from "picocolors";

import { listFlag, type ParsedArgs } from "./args";
import { detectFramework } from "./create/frameworks";
import { detectPm, installedLibraries, packageName, readDeps } from "./create/detect";
import { describe, execute } from "./exec";
import { hashFile, readLock, writeLock } from "./lockfile";
import { loadCatalog } from "./registry";
import { reportEvent } from "./telemetry";

/**
 * `create-first-commit add <library|owner/repo@skill>` — adds a catalog library (the variant
 * for this project's framework) or a skill to an existing project, with its
 * packages, config files, skill, MCP server and AGENTS.md rule.
 */
export async function add(args: ParsedArgs, guard: <T>(v: T) => Exclude<T, symbol>, cliVersion: string): Promise<void> {
  const target = args.positionals[0];
  if (!target) throw new Error("Uso: add <biblioteca|owner/repo@skill>   (p. ej. add sentry, add kokonutui)");
  const dir = resolve(args.flags.get("dir")?.[0] ?? ".");
  if (!existsSync(join(dir, "package.json"))) throw new Error(`No package.json in ${dir}`);
  const interactive = Boolean(process.stdin.isTTY) && !args.switches.has("yes");
  const force = args.switches.has("force");

  const lock = await readLock(dir);
  const deps = readDeps(dir);
  const framework = detectFramework(deps);
  const frameworks = framework?.frameworks ?? [];
  const pm = lock?.pm ?? detectPm(dir);
  const agents = listFlag(args, "agent") ?? (lock?.agents.length ? lock.agents : ["claude-code"]);
  const title = basename(dir);
  p.intro(pc.bgWhite(pc.black(" add ")));

  let steps: Step[];
  let lib: Library | undefined;
  if (skillRefSchema.safeParse(target).success) {
    steps = [
      ...skillSteps({ skills: [target], agents, pm, cwd: dir }),
      ...agentStubs(agents, dir),
    ];
  } else {
    const catalog = await loadCatalog();
    const named = catalog.filter((l) => l.id === target || l.id.startsWith(`${target}-`) || slug(l.name) === target);
    if (!named.length) throw new Error(`"${target}" isn't in the catalog. See the libraries at ${BRAND.siteUrl}/docs/libraries.`);
    const fitting = named.filter((l) => l.frameworks.some((f) => frameworks.includes(f)));
    const fwLabel = frameworks.map((f) => FRAMEWORK_LABELS[f] ?? f).join(" / ") || "unknown framework";
    if (!fitting.length) {
      throw new Error(`${named[0]!.name} has no variant for ${fwLabel}. Available: ${named.map((l) => `${l.id} (${l.frameworks.join(", ")})`).join(", ")}`);
    }
    if (fitting.length === 1) lib = fitting[0]!;
    else if (interactive) {
      const id = guard(await p.select({ message: "Which variant?", options: fitting.map((l) => ({ value: l.id, label: `${l.name} (${l.id})` })) }));
      lib = fitting.find((l) => l.id === id)!;
    } else throw new Error(`Several variants fit: ${fitting.map((l) => l.id).join(", ")}. Pass the exact id.`);

    const installed = installedLibraries(dir, catalog, frameworks, deps);
    const already = installed[lib.kind].some((l) => l.id === lib!.id);
    if (lib.kind === "components") {
      const others = installed.components.filter((l) => l.id !== lib!.id);
      if (others.length) {
        p.log.warn(`You already use ${others.map((l) => l.name).join(", ")}. The AGENTS.md rule will say to use only ${lib.name}.`);
        if (!force && !(interactive && guard(await p.confirm({ message: "Continue?", initialValue: false })))) throw new Error("Cancelled. Use --force to continue.");
      }
    }
    for (const [option, ids] of Object.entries(lib.requires ?? {})) {
      if (!requirementMet(option, ids, lock, installed, deps) && !force) {
        const hint = option === "components" ? ` Add it first: add ${ids[0]}` : "";
        throw new Error(`${lib.name} needs ${option}: ${ids.join(" or ")}.${hint} (or --force)`);
      }
    }

    const vars = templateVars({ options: lock?.options ?? {}, addSkills: [], removeSkills: [], agents, pm }, title);
    const missing = (list: string[]) => list.filter((d) => !(packageName(d) in deps));
    const tasks = [...(lib.setup ? [`${lib.name}: ${lib.setup}`] : []), ...lib.setupTasks];
    const block = [libraryRule(lib), tasks.length ? `### Primeros pasos\n\n${tasks.map((t) => `- [ ] ${t}`).join("\n")}` : ""].filter(Boolean).join("\n\n");
    steps = [
      ...dependencySteps({ addCommand: framework?.addCommand, pm, dependencies: missing(lib.dependencies), devDependencies: missing(lib.devDependencies), cwd: dir, vars }),
      ...lib.writeFiles.map((f) => ({
        kind: "write" as const,
        title: f.mode === "create" ? "Create file" : "Append to",
        path: join(dir, f.path),
        merge: applyWrite({ ...f, content: f.content }),
        optional: true,
      })),
      // Setup commands only for a library that wasn't there yet.
      ...(already ? [] : lib.postInstall.map((command) => ({ kind: "run" as const, title: "Configurar", command, cwd: dir, optional: true }))),
      ...skillSteps({ skills: lib.skills, agents, pm, cwd: dir }),
      ...mcpSteps({ mcp: lib.mcp, agents, projectDir: dir, join }),
      ...(Object.keys(lib.env).length ? [{ kind: "write" as const, title: "Environment variables", path: join(dir, ".env.example"), merge: mergeEnv(lib.env) }] : []),
      { kind: "write", title: `${lib.name} rule in AGENTS.md`, path: join(dir, "AGENTS.md"), merge: upsertBlock(`kits-add-${lib.id}`, block, title) },
      ...agentStubs(agents, dir),
    ];
    if (already) p.log.info(`${lib.name} was already installed: adding its rule, skill and config.`);
  }

  p.note(steps.map((s, i) => `${pc.dim(`${i + 1}.`)} ${describe(s, dir)}`).join("\n"), lib ? `${lib.name} (${lib.id})` : target);
  if (args.switches.has("dry-run")) {
    p.outro("Dry run: nothing was changed.");
    return;
  }
  if (interactive && !guard(await p.confirm({ message: "Apply?" }))) {
    p.cancel("Cancelled.");
    return;
  }
  const failed = await execute(steps, dir, { verbose: args.switches.has("verbose") });

  const base: KitsLock = lock ?? {
    lockVersion: 1,
    kit: null,
    version: null,
    options: {},
    skills: [],
    agents,
    pm,
    dependencies: [],
    devDependencies: [],
    added: [],
    addedSkills: [],
    managedFiles: {},
    brand: null,
    updatedAt: new Date().toISOString(),
  };
  const managed = { ...base.managedFiles };
  for (const f of lib?.writeFiles ?? []) if (f.mode === "create" && existsSync(join(dir, f.path))) managed[f.path] ??= hashFile(join(dir, f.path));
  await writeLock(dir, {
    ...base,
    added: lib ? [...base.added.filter((a) => a.id !== lib!.id), { id: lib.id, at: new Date().toISOString() }] : base.added,
    addedSkills: lib ? [...new Set([...base.addedSkills, ...lib.skills])] : [...new Set([...base.addedSkills, target])],
    dependencies: [...new Set([...base.dependencies, ...(lib?.dependencies ?? [])])],
    devDependencies: [...new Set([...base.devDependencies, ...(lib?.devDependencies ?? [])])],
    managedFiles: managed,
  });
  if (lock?.kit) {
    await reportEvent("add", lock.kit, lock.version ?? undefined, { options: { added: [lib?.id ?? target] }, addSkills: [], removeSkills: [], agents, pm }, [], cliVersion);
  }
  if (failed.length) p.log.warn(`${failed.length} step(s) failed:\n${failed.map((s) => `  ${describe(s, dir)}`).join("\n")}`);
  p.outro(`${pc.green("Added")} ${lib?.name ?? target}.${lib && (lib.setup || lib.setupTasks.length) ? " Check the first steps in AGENTS.md." : ""}`);
}

/** Requirement check without a kit option: fall back to what's installed. */
function requirementMet(
  option: string,
  ids: string[],
  lock: KitsLock | null,
  installed: ReturnType<typeof installedLibraries>,
  deps: Record<string, string>,
): boolean {
  if ((lock?.options[option] ?? []).some((id) => ids.includes(id))) return true;
  if (option === "components") return installed.components.some((l) => ids.includes(l.id)) || (lock?.added ?? []).some((a) => ids.includes(a.id));
  // Choice ids that are package names (e.g. styling: nativewind).
  return ids.some((id) => id in deps);
}

function agentStubs(agents: string[], dir: string): Step[] {
  return agents.flatMap((a) =>
    INSTRUCTION_STUBS[a] ? [{ kind: "write" as const, title: `Link ${INSTRUCTION_STUBS[a]} to AGENTS.md`, path: join(dir, INSTRUCTION_STUBS[a]!), merge: importAgentsMd }] : [],
  );
}

const slug = (value: string) => slugify(value);
