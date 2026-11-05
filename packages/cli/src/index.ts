import { existsSync } from "node:fs";
import { join, resolve as resolvePath } from "node:path";

import * as p from "@clack/prompts";
import {
  AGENTS,
  BRAND,
  buildPlan,
  allKitSkills,
  buildInitCommand,
  defaultSelections,
  PACKAGE_MANAGERS,
  pruneSelections,
  requirementsMet,
  resolve,
  skillRefSchema,
  validateSelections,
  type Kit,
  type PackageManager,
  type Selections,
} from "@kits/schema";
import pc from "picocolors";

import { listFlag, parseArgs, type ParsedArgs } from "./args";
import { create } from "./create";
import { lockKitRef, managedFiles, newLock, writeLock } from "./lockfile";
import { login, logout, publish, whoami } from "./account";
import { add } from "./add";
import { applyBrand, brand, describeBrand, loadBrand } from "./brand";
import { doctor } from "./doctor";
import { mcp } from "./mcp";
import { updateNotice } from "./notice";
import { test } from "./test";
import { update } from "./update";
import { kitTrust } from "./trust";
import { describe, execute } from "./exec";
import { nodePaths } from "./paths";
import { loadIndex, loadKit } from "./registry";
import { reportInstall } from "./telemetry";

const VERSION = "0.1.0";

const CLI = `npx ${BRAND.cli}`;

const HELP = `
${pc.bold(BRAND.name)} — workspaces listos para programar con tu agente

${pc.bold("Uso")}
  ${CLI}                         elige un kit y crea el proyecto
  ${CLI} <kit> [nombre] [opciones]  crea el proyecto (o: init <kit>)
  ${CLI} list
  ${CLI} info <kit>
  ${CLI} create [carpeta]        convierte un proyecto en un kit
  ${CLI} create --blank <nombre> kit vacío para escribir a mano
  ${CLI} test [kit]              instala y compila el kit con varias combinaciones
  ${CLI} login | logout | whoami  sesión para publicar (token de ${BRAND.siteUrl}/cuenta)
  ${CLI} publish [carpeta]       publica el kit en el commit actual (debe estar en GitHub)
                                 --org <org>: en el registro privado de tu organización

${pc.bold("Dentro de un proyecto")}
  ${CLI} update [versión]        trae las mejoras del kit (no toca tus archivos modificados)
  ${CLI} add <biblioteca|skill>  añade sentry, posthog, kokonutui… o owner/repo@skill
  ${CLI} doctor [--json]         comprueba que el proyecto sigue sus reglas
  ${CLI} brand <dueño/nombre>    aplica un perfil de marca (colores, fuentes, reglas y docs de la empresa)
  ${CLI} brand detect [carpeta]  crea un brand.json a partir de los estilos de un proyecto

${pc.bold("Para agentes")}
  ${CLI} mcp                     servidor MCP (stdio): buscar, recomendar, planear y crear proyectos

${pc.bold("Kits")}
  mobile-expo            kit oficial
  usuario/repo[/ruta]    kit de la comunidad en GitHub
  ./ruta/al/kit          kit local

${pc.bold("Opciones al crear")}
  --<opción> <valor>     elige una opción del kit (ver \`${BRAND.cli} info <kit>\`)
  --skill <owner/repo@skill>   añade un skill (repetible)
  --no-skill <owner/repo@skill> quita un skill del kit (repetible)
  --no-skills            no instala ningún skill
  --agent <a,b>          agentes: ${AGENTS.map((a) => a.id).join(", ")}
  --pm <npm|pnpm|bun>    gestor de paquetes
  --dry-run              muestra el plan sin ejecutar nada
  --no-git               no hace commit inicial
  --brand <dueño/nombre> aplica un perfil de marca (o --brand ./brand.json)
  --allow-commands       con -y, permite ejecutar un kit de la comunidad sin verificar
  -y, --yes              sin preguntas: usa los valores por defecto

${pc.bold("Opciones de create")}
  --out <carpeta>        dónde escribir el kit (por defecto ./kit)
  --name, --title, --description, --category
  --include <rutas>      archivos propios a copiar, separados por coma
  --base "<comando>"     comando que crea el proyecto, si el framework no se reconoce
  -y, --yes              sin preguntas

${pc.bold("Opciones de test")}
  --only-defaults        prueba solo los valores por defecto
  --max <n>              máximo de combinaciones
  --timeout <min>        tiempo máximo por comando (20)
  --report <archivo>     dónde escribir el informe (kits-test-report.json)
  --skip-skills          no comprueba que los skills existen
  --keep                 conserva los proyectos de prueba (por defecto se borran)
  --upload               envía el informe firmado (solo en GitHub Actions)

${pc.dim(`${BRAND.name} cuenta instalaciones de forma anónima (kit, opciones, agentes).`)}
${pc.dim("Desactívalo con DO_NOT_TRACK=1.")}
`;

const COMMANDS = new Set(["init", "create", "test", "login", "logout", "whoami", "publish", "update", "add", "doctor", "mcp", "brand", "list", "ls", "info"]);

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.switches.has("version")) return console.log(VERSION);
  if (args.switches.has("help")) return console.log(HELP);
  // Like create-vite: no command in a terminal opens the kit picker; a kit name means `init`.
  if (!args.command) {
    if (!process.stdin.isTTY) return console.log(HELP);
    return init(args);
  }
  if (!COMMANDS.has(args.command)) return init({ ...args, positionals: [args.command, ...args.positionals], command: "init" });

  switch (args.command) {
    case "init":
      return init(args);
    case "create":
      return create(args, guard);
    case "test":
      return test(args, VERSION);
    case "login":
      return login(args, guard);
    case "logout":
      return logout();
    case "whoami":
      return whoami();
    case "publish":
      return publish(args);
    case "update":
      return update(args, guard, VERSION);
    case "add":
      return add(args, guard, VERSION);
    case "doctor":
      return doctor(args);
    case "mcp":
      return mcp(args, VERSION);
    case "brand":
      return brand(args);
    case "list":
    case "ls":
      return list();
    case "info":
      return info(args);
    default:
      throw new Error(`Comando desconocido "${args.command}". Ejecuta \`${CLI} --help\`.`);
  }
}

async function list() {
  const entries = await loadIndex();
  for (const e of entries) {
    console.log(`${pc.bold(e.name.padEnd(22))} ${e.title}  ${pc.dim(`· ${e.skills} skills`)}`);
  }
  console.log(pc.dim(`\n${CLI} <kit>  ·  ${CLI} info <kit>`));
}

async function info(args: ParsedArgs) {
  const ref = args.positionals[0];
  if (!ref) throw new Error(`Uso: ${CLI} info <kit>`);
  const { kit } = await loadKit(ref);
  console.log(`\n${pc.bold(kit.title)} ${pc.dim(`(${kit.name}@${kit.version})`)}\n${kit.description}\n`);
  for (const o of kit.options) {
    const defaults = Array.isArray(o.default) ? o.default : [o.default];
    console.log(`${pc.cyan(`--${o.id}`)} ${pc.dim(o.type === "multi" ? "(varios, separados por coma)" : "")}`);
    for (const c of o.choices) console.log(`  ${defaults.includes(c.id) ? pc.green("●") : "○"} ${c.id.padEnd(20)} ${pc.dim(c.label)}`);
  }
  console.log(`\n${pc.bold("Skills")}`);
  for (const s of kit.skills) console.log(`  ${s}`);
  console.log();
}

async function init(args: ParsedArgs) {
  const interactive = Boolean(process.stdin.isTTY) && !args.switches.has("yes");
  let ref = args.positionals[0];
  if (!ref) {
    if (!interactive) throw new Error(`Uso: ${CLI} <kit> [nombre]`);
    const entries = await loadIndex();
    ref = guard(
      await p.select({
        message: "¿Qué quieres crear?",
        options: entries.map((e) => ({ value: e.name, label: e.title, hint: e.name })),
      }),
    );
  }

  p.intro(pc.bgCyan(pc.black(` ${BRAND.name} `)));
  const spinner = p.spinner();
  spinner.start(`Cargando ${ref}`);
  let loaded: Awaited<ReturnType<typeof loadKit>>;
  try {
    loaded = await loadKit(ref);
  } catch (error) {
    spinner.error(`No se pudo cargar ${ref}`);
    throw error;
  }
  spinner.stop(`${loaded.kit.title}`);
  const { kit } = loaded;

  let name = args.positionals[1];
  if (!name) {
    name = interactive
      ? guard(await p.text({ message: "Nombre del proyecto", placeholder: kit.name, defaultValue: kit.name }))
      : kit.name;
  }
  if (!/^[\w.-]+$/.test(name)) throw new Error(`Nombre de proyecto no válido: "${name}"`);
  const parentDir = process.cwd();
  if (existsSync(join(parentDir, name))) throw new Error(`Ya existe un directorio "${name}"`);

  const sel = await collectSelections(kit, args, interactive);
  validateSelections(kit, sel);

  const steps = buildPlan({ kit, kitDir: loaded.dir, sel, parentDir, name, git: !args.switches.has("no-git"), paths: nodePaths });
  const projectDir = resolvePath(parentDir, name);
  // --brand acme/web: the company's colors, fonts, rules and docs, applied after the kit.
  const brandRef = args.flags.get("brand")?.[0];
  const brandProfile = brandRef ? await loadBrand(brandRef) : null;

  const trust = await kitTrust(ref, kit.version);
  const unverified = trust === "unverified";
  p.note(
    [...steps.map((s) => describe(s, projectDir)), ...(brandProfile ? [describeBrand(brandProfile)] : [])]
      .map((line, i) => `${pc.dim(`${i + 1}.`)} ${line}`)
      .join("\n"),
    unverified ? "Plan · kit de la comunidad SIN VERIFICAR" : trust === "verified" ? "Plan · kit verificado" : "Plan",
  );
  if (args.switches.has("dry-run")) {
    p.outro(`Dry run: no se ha ejecutado nada.\n   ${pc.dim(buildInitCommand(ref, kit, sel, name))}`);
    return;
  }
  // Kits run shell commands: show them and ask before running anything from a third party.
  if (unverified) {
    if (!interactive && !args.switches.has("allow-commands")) {
      throw new Error(
        `${ref} es un kit de la comunidad sin verificar. Revisa el plan con --dry-run y añade --allow-commands para ejecutarlo sin preguntas.`,
      );
    }
    if (interactive) {
      p.log.warn(
        "Este kit no está verificado: nadie ha comprobado que funcione ni qué ejecuta. Revisa los comandos del plan como revisarías un script.",
      );
      if (!guard(await p.confirm({ message: "¿Confías en este kit y quieres ejecutar sus comandos?", initialValue: false }))) {
        p.cancel("Cancelado.");
        return;
      }
    }
  }
  if (interactive && !guard(await p.confirm({ message: "¿Ejecutar este plan?" }))) {
    p.cancel("Cancelado.");
    return;
  }

  // The commit goes last, after kits.lock exists, so the lock is part of it.
  const gitStep = steps.at(-1)?.kind === "git" ? steps.pop() : undefined;
  const failed = await execute(steps, projectDir);
  if (brandProfile) applyBrand(brandProfile, projectDir);
  const r = resolve(kit, sel);
  // kits.lock: what `update`, `add` and `doctor` need to know about this project.
  await writeLock(
    projectDir,
    newLock({
      kit: lockKitRef(ref),
      version: kit.version,
      registry: process.env.KITS_API_URL ?? BRAND.siteUrl,
      sel,
      r,
      managed: managedFiles(projectDir, loaded.dir, r),
      brand: brandProfile && brandRef ? { ref: brandRef, title: brandProfile.title } : null,
    }),
  );
  if (gitStep) await execute([gitStep], projectDir);
  await reportInstall(ref, kit.version, sel, r.skills, VERSION);

  const next = [`cd ${name}`];
  if (Object.keys(r.env).length) next.push("cp .env.example .env   # y rellena las claves");
  next.push(...sel.agents.filter((a) => a in AGENT_COMMANDS).map((a) => AGENT_COMMANDS[a]!));
  p.note(next.join("\n"), "Siguiente paso");
  if (failed.length) {
    p.log.warn(`${failed.length} paso(s) fallaron. Puedes reintentarlos a mano:\n${failed.map((s) => `  ${describe(s, projectDir)}`).join("\n")}`);
    p.outro(pc.yellow("Proyecto creado con avisos."));
  } else {
    p.outro(`${pc.green("Listo.")} ${r.skills.length} skills instalados para ${sel.agents.join(", ")}.`);
  }
}

const AGENT_COMMANDS: Record<string, string> = {
  "claude-code": "claude",
  codex: "codex",
  "gemini-cli": "gemini",
  cursor: "cursor .",
  opencode: "opencode",
};

async function collectSelections(kit: Kit, args: ParsedArgs, interactive: boolean): Promise<Selections> {
  let sel = defaultSelections(kit);
  const explicit = new Set<string>();

  // Options come in kit order, so choices that depend on an earlier answer
  // (a library that needs React, an add-on that needs shadcn) are filtered live.
  for (const option of kit.options) {
    const flag = listFlag(args, option.id);
    if (flag) {
      // "--extras none" clears a multi option, unless "none" is a real choice.
      const clears = option.type === "multi" && flag.length === 1 && flag[0] === "none" && !option.choices.some((c) => c.id === "none");
      sel.options[option.id] = clears ? [] : flag;
      explicit.add(option.id);
    } else {
      sel = pruneSelections(kit, sel, explicit);
      const allowed = option.choices.filter((c) => requirementsMet(c, sel));
      if (interactive && allowed.length) {
        const choices = allowed.map((c) => ({ value: c.id, label: c.label, hint: c.description }));
        const current = sel.options[option.id] ?? [];
        sel.options[option.id] =
          option.type === "multi"
            ? guard(await p.multiselect({ message: option.label, options: choices, initialValues: current, required: false }))
            : [guard(await p.select({ message: option.label, options: choices, initialValue: current[0] ?? allowed[0]!.id }))];
      }
    }
  }
  sel = pruneSelections(kit, sel, explicit);

  const added = listFlag(args, "skill") ?? [];
  for (const s of added) {
    if (!skillRefSchema.safeParse(s).success) throw new Error(`Skill no válido "${s}". Formato: owner/repo@skill`);
  }
  sel.addSkills = added;
  const removed = listFlag(args, "no-skill") ?? [];
  if (args.switches.has("no-skills")) {
    sel.removeSkills = allKitSkills(kit);
  } else if (removed.length || added.length || !interactive) {
    sel.removeSkills = removed;
  } else {
    const kitSkills = resolve(kit, sel).skills;
    const keep = guard(
      await p.multiselect({
        message: "Skills a instalar",
        options: kitSkills.map((s) => ({ value: s, label: s })),
        initialValues: kitSkills,
        required: false,
      }),
    );
    sel.removeSkills = kitSkills.filter((s) => !keep.includes(s));
  }

  const agents = listFlag(args, "agent");
  if (agents) {
    const known = new Set<string>(AGENTS.map((a) => a.id));
    // Unknown ids still go to the skills CLI, which supports many more agents.
    for (const a of agents) if (!known.has(a)) p.log.warn(`Agente "${a}": se instalarán los skills, pero kits no sabe configurar su MCP.`);
    sel.agents = agents;
  } else if (interactive) {
    sel.agents = guard(
      await p.multiselect({
        message: "¿Con qué agentes vas a trabajar?",
        options: AGENTS.map((a) => ({ value: a.id, label: a.label })),
        initialValues: sel.agents,
        required: true,
      }),
    );
  }

  const pm = args.flags.get("pm")?.[0] ?? detectPm();
  if (pm) {
    if (!PACKAGE_MANAGERS.includes(pm as PackageManager)) throw new Error(`--pm debe ser ${PACKAGE_MANAGERS.join(", ")}`);
    sel.pm = pm as PackageManager;
  } else if (interactive && kit.packageManagers.length > 1) {
    sel.pm = guard(
      await p.select({
        message: "Gestor de paquetes",
        options: kit.packageManagers.map((m) => ({ value: m, label: m })),
        initialValue: sel.pm,
      }),
    );
  }
  return sel;
}

/** `pnpm dlx <cli>` / `bunx <cli>` → use that package manager. Plain npx asks (or defaults to npm). */
function detectPm(): PackageManager | undefined {
  const ua = process.env.npm_config_user_agent ?? "";
  if (ua.startsWith("pnpm")) return "pnpm";
  if (ua.startsWith("bun")) return "bun";
  return undefined;
}

function guard<T>(value: T): Exclude<T, symbol> {
  if (p.isCancel(value)) {
    p.cancel("Cancelado.");
    process.exit(0);
  }
  return value as Exclude<T, symbol>;
}

main()
  .then(async () => {
    // `update` and `doctor` already report versions; `init` creates a new project.
    const command = process.argv[2];
    if (command && !["init", "update", "doctor", "mcp"].includes(command)) await updateNotice(process.cwd());
  })
  .catch((error: Error) => {
    p.log.error(error.message);
    process.exit(1);
  });
