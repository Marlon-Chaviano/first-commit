import { existsSync } from "node:fs";
import { cp, mkdir, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";

import * as p from "@clack/prompts";
import {
  BRAND,
  buildPlan,
  LIBRARY_CATEGORIES,
  cliCommand,
  defaultSelections,
  expandKit,
  PACKAGE_MANAGERS,
  parseKit,
  REGISTRY_RAW_BASE,
  validateSelections,
  type Kit,
} from "@kits/schema";
import pc from "picocolors";

import { listFlag, type ParsedArgs } from "../args";
import { describe } from "../exec";
import { nodePaths } from "../paths";
import { loadCatalog } from "../registry";
import { detectProject, type Detection } from "./detect";

const CATEGORIES: Kit["category"][] = ["mobile", "web", "landing", "saas", "api", "extension", "other"];

/** `create-first-commit create [dir]` — turns an existing project into a kit. */
export async function create(args: ParsedArgs, guard: <T>(v: T) => Exclude<T, symbol>): Promise<void> {
  if (args.switches.has("blank")) return createBlank(args);

  const dir = resolve(args.positionals[0] ?? ".");
  const out = resolve(args.flags.get("out")?.[0] ?? join(dir, "kit"));
  const interactive = Boolean(process.stdin.isTTY) && !args.switches.has("yes");

  p.intro(pc.bgCyan(pc.black(` ${BRAND.name} create `)));
  const spinner = p.spinner();
  spinner.start(`Analizando ${relative(process.cwd(), dir) || "."}`);
  let d: Detection;
  try {
    d = await detectProject(dir, await loadCatalog(), args.flags.get("base")?.[0]);
  } catch (error) {
    spinner.error("No se pudo analizar el proyecto");
    throw error;
  }
  spinner.stop(`${d.framework.label} · ${d.skills.length} skills · ${Object.keys(d.mcp).length} MCP · ${d.dependencies.length + d.devDependencies.length} dependencias propias`);

  const libs = [d.libraries.components, ...d.libraries.addons, ...d.libraries.animation, ...d.libraries.observability, ...d.libraries.others].filter(Boolean);
  if (libs.length) p.log.info(`Bibliotecas del catálogo detectadas: ${libs.map((l) => l!.name).join(", ")}`);
  if (d.unknownSkills.length) {
    p.log.warn(`Skills sin origen conocido (no están en skills-lock.json), no se incluyen: ${d.unknownSkills.join(", ")}`);
  }

  const ask = async (flag: string | undefined, prompt: () => Promise<string | symbol>, fallback: string): Promise<string> =>
    flag !== undefined ? flag : interactive ? (guard(await prompt()) as string) : fallback;

  const name = slug(
    await ask(args.flags.get("name")?.[0], () => p.text({ message: "Nombre del kit", initialValue: slug(d.packageName) }), slug(d.packageName)),
  );
  const title = await ask(args.flags.get("title")?.[0], () => p.text({ message: "Título", initialValue: name }), name);
  const description = await ask(
    args.flags.get("description")?.[0],
    () => p.text({ message: "Descripción (qué consigue alguien al usarlo)", placeholder: `Plantilla de ${d.framework.label}` }),
    `Plantilla de ${d.framework.label}`,
  );
  const category = (await ask(
    args.flags.get("category")?.[0],
    () => p.select<string>({ message: "Categoría", options: CATEGORIES.map((c) => ({ value: c, label: c })), initialValue: d.framework.category }),
    d.framework.category,
  )) as Kit["category"];
  if (!CATEGORIES.includes(category)) throw new Error(`--category debe ser una de: ${CATEGORIES.join(", ")}`);

  const pick = async (message: string, items: string[], preselect: boolean) =>
    !interactive || !items.length
      ? preselect
        ? items
        : []
      : guard(await p.multiselect<string>({ message, options: items.map((v) => ({ value: v, label: v })), initialValues: preselect ? items : [], required: false }));

  const dependencies = await pick("Dependencias propias del kit", d.dependencies, true);
  const devDependencies = await pick("Dependencias de desarrollo", d.devDependencies, true);
  const skills = await pick("Skills", d.skills, true);
  const mcpNames = await pick("Servidores MCP", Object.keys(d.mcp), true);

  let instructions = d.instructions;
  if (instructions && interactive) {
    p.note(instructions.split("\n").slice(0, 8).join("\n") + (instructions.split("\n").length > 8 ? "\n…" : ""), "Instrucciones de AGENTS.md");
    if (!guard(await p.confirm({ message: "¿Incluir estas instrucciones en el kit?" }))) instructions = undefined;
  }

  // Files are opt-in: a kit should ship config and helpers, not the creator's whole app.
  const includeFlag = listFlag(args, "include");
  let files: string[] = [];
  if (includeFlag) {
    files = d.fileGroups
      .filter((g) => includeFlag.some((i) => g.path === i || g.path.startsWith(`${i}/`) || i.startsWith(`${g.path}/`)))
      .flatMap((g) => g.files);
  } else if (interactive && d.fileGroups.length) {
    const chosen = guard(
      await p.multiselect<string>({
        message: "Archivos propios que se copiarán al proyecto (configuración, utilidades…)",
        options: d.fileGroups.map((g) => ({ value: g.path, label: g.path, hint: g.files.length > 1 ? `${g.files.length} archivos` : undefined })),
        initialValues: [] as string[],
        required: false,
      }),
    );
    files = d.fileGroups.filter((g) => chosen.includes(g.path)).flatMap((g) => g.files);
  }

  const kitJson = buildKitJson(d, { name, title, description, category, dependencies, devDependencies, skills, mcpNames, instructions, hasFiles: files.length > 0 });

  // Validate exactly as the CLI and the website will read it.
  const kit = expandKit(parseKit(kitJson), await loadCatalog());
  validateSelections(kit, defaultSelections(kit));

  const steps = buildPlan({ kit, kitDir: out, sel: defaultSelections(kit), parentDir: process.cwd(), name: "mi-proyecto", git: true, paths: nodePaths });
  p.note(steps.map((s, i) => `${pc.dim(`${i + 1}.`)} ${describe(s, resolve("mi-proyecto"))}`).join("\n"), "Así se instalará");

  if (existsSync(join(out, "kit.json")) && interactive) {
    if (!guard(await p.confirm({ message: `${relative(process.cwd(), out)}/kit.json ya existe. ¿Sobrescribirlo?`, initialValue: false }))) {
      p.cancel("Cancelado.");
      return;
    }
  }

  await mkdir(out, { recursive: true });
  await writeFile(join(out, "kit.json"), JSON.stringify(kitJson, null, 2) + "\n");
  for (const f of files) {
    await mkdir(join(out, "files", f, ".."), { recursive: true });
    await cp(join(dir, f), join(out, "files", f));
  }

  const rel = relative(process.cwd(), out) || ".";
  const next = [`${cliCommand(`./${rel} mi-proyecto --dry-run`)}   # pruébalo`];
  if (d.githubRepo) next.push(`${cliCommand(`${d.githubRepo}/${relative(dir, out)}`)}   # tras hacer push`);
  p.note(next.join("\n"), "Siguiente paso");
  p.outro(`${pc.green("Kit creado")} en ${rel}/kit.json${files.length ? ` con ${files.length} archivos` : ""}.`);
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
export function buildKitJson(d: Detection, a: Answers): Record<string, unknown> {
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
    if (found.length) (libraries as Record<string, unknown>)[category.key] = category.type === "select" ? found[0]!.id : found.map((x) => x.id);
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
    author: d.githubRepo?.split("/")[0] ?? "anónimo",
    base: f.base,
    ...(f.addCommand ? { addCommand: f.addCommand } : {}),
    // The creator's package manager becomes the default.
    packageManagers: [d.pm, ...PACKAGE_MANAGERS.filter((pm) => pm !== d.pm)],
    libraries,
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

/** `create-first-commit create --blank [nombre]` — an empty kit.json to fill by hand. */
async function createBlank(args: ParsedArgs): Promise<void> {
  const name = slug(args.positionals[0] ?? "mi-kit");
  const out = resolve(args.flags.get("out")?.[0] ?? name);
  if (existsSync(join(out, "kit.json"))) throw new Error(`${join(out, "kit.json")} ya existe`);
  const kit = {
    $schema: `${REGISTRY_RAW_BASE}/kit.schema.json`,
    name,
    version: "0.1.0",
    title: name,
    description: "Qué consigue alguien al usar este kit.",
    category: "web",
    author: "tu-usuario",
    base: { command: "npx create-next-app@latest {{name}} --yes --use-{{pm}}" },
    skills: [],
    instructions: "## Cómo trabajar aquí\n\n- Reglas para el agente.",
  };
  await mkdir(out, { recursive: true });
  await writeFile(join(out, "kit.json"), JSON.stringify(kit, null, 2) + "\n");
  console.log(`Creado ${relative(process.cwd(), join(out, "kit.json"))}. Pruébalo con: ${cliCommand(`./${basename(out)} demo --dry-run`)}`);
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/^@[^/]+\//, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "mi-kit";
}
