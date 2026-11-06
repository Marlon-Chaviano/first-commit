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
  pmFromUserAgent,
  pruneSelections,
  requirementsMet,
  resolve,
  selectionsFrom,
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
import { applyBrand, brand, describeBrand, downloadBrandAssets, loadBrand } from "./brand";
import { doctor } from "./doctor";
import { mcp } from "./mcp";
import { updateNotice } from "./notice";
import { test } from "./test";
import { update } from "./update";
import { kitTrust } from "./trust";
import { describe, execute } from "./exec";
import { closest, commandHelp, helpText } from "./help";
import { nodePaths } from "./paths";
import { loadIndex, loadKit } from "./registry";
import { reportInstall } from "./telemetry";

const VERSION = "0.1.0";

const CLI = `npx ${BRAND.cli}`;

const COMMANDS = new Set(["help", "init", "create", "test", "login", "logout", "whoami", "publish", "update", "add", "doctor", "mcp", "brand", "list", "ls", "info"]);

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.switches.has("version")) return console.log(`${BRAND.cli} ${VERSION}`);
  if (args.switches.has("help") || args.command === "help") {
    const topic = args.command === "help" ? args.positionals[0] : args.command;
    return console.log((topic && commandHelp(topic)) ?? helpText(VERSION));
  }
  // Like create-vite: no command in a terminal opens the kit picker; a kit name means `init`.
  if (!args.command) {
    if (!process.stdin.isTTY) return console.log(helpText(VERSION));
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
      throw new Error(`Unknown command "${args.command}". Run \`${CLI} --help\`.`);
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
  if (!ref) throw new Error(`Usage: ${CLI} info <kit>`);
  const { kit } = await loadKit(ref);
  console.log(`\n${pc.bold(kit.title)} ${pc.dim(`(${kit.name}@${kit.version})`)}\n${kit.description}\n`);
  for (const o of kit.options) {
    const defaults = Array.isArray(o.default) ? o.default : [o.default];
    console.log(`${pc.cyan(`--${o.id}`)} ${pc.dim(o.type === "multi" ? "(several, comma-separated)" : "")}`);
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
    if (!interactive) throw new Error(`Usage: ${CLI} <kit> [name]`);
    const entries = await loadIndex();
    ref = guard(
      await p.select({
        message: "What do you want to create?",
        options: entries.map((e) => ({ value: e.name, label: e.title, hint: e.name })),
      }),
    );
  }

  p.intro(pc.bgWhite(pc.black(` ${BRAND.name} `)));
  const spinner = p.spinner();
  spinner.start(`Loading ${ref}`);
  let loaded: Awaited<ReturnType<typeof loadKit>>;
  try {
    loaded = await loadKit(ref);
  } catch (error) {
    spinner.error(`Couldn't load ${ref}`);
    // A mistyped official kit or command: suggest the closest ones instead of only failing.
    if (!ref.includes("/") && !ref.startsWith(".")) {
      const names = await loadIndex()
        .then((entries) => entries.map((e) => e.name))
        .catch(() => [] as string[]);
      const suggestions = closest(ref, [...names, ...COMMANDS]);
      if (suggestions.length) throw new Error(`"${ref}" isn't a kit or a command. Did you mean ${suggestions.map((s) => pc.cyan(s)).join(", ")}?\n   ${pc.dim(`${CLI} list shows every kit.`)}`);
    }
    throw error;
  }
  spinner.stop(`${loaded.kit.title}`);
  const { kit } = loaded;

  let name = args.positionals[1];
  if (!name) {
    name = interactive
      ? guard(await p.text({ message: "Project name", placeholder: kit.name, defaultValue: kit.name }))
      : kit.name;
  }
  if (!/^[\w.-]+$/.test(name)) throw new Error(`Invalid project name: "${name}"`);
  const parentDir = process.cwd();
  if (existsSync(join(parentDir, name))) throw new Error(`A directory named "${name}" already exists`);

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
    unverified ? "Plan · UNVERIFIED community kit" : trust === "verified" ? "Plan · verified kit" : "Plan",
  );
  if (args.switches.has("dry-run")) {
    p.outro(`Dry run: nothing was run.\n   ${pc.dim(buildInitCommand(ref, kit, sel, name))}`);
    return;
  }
  // Kits run shell commands: show them and ask before running anything from a third party.
  if (unverified) {
    if (!interactive && !args.switches.has("allow-commands")) {
      throw new Error(
        `${ref} is an unverified community kit. Review the plan with --dry-run and add --allow-commands to run it without prompts.`,
      );
    }
    if (interactive) {
      p.log.warn(
        "This kit isn't verified: nobody has checked that it works or what it runs. Review the plan's commands as you would review a script.",
      );
      if (!guard(await p.confirm({ message: "Do you trust this kit and want to run its commands?", initialValue: false }))) {
        p.cancel("Cancelled.");
        return;
      }
    }
  }
  if (interactive && !guard(await p.confirm({ message: "Run this plan?" }))) {
    p.cancel("Cancelled.");
    return;
  }

  // The commit goes last, after kits.lock exists, so the lock is part of it.
  const gitStep = steps.at(-1)?.kind === "git" ? steps.pop() : undefined;
  const verbose = args.switches.has("verbose");
  let failed: Awaited<ReturnType<typeof execute>>;
  try {
    failed = await execute(steps, projectDir, { verbose });
  } catch (error) {
    // The half-made project would block the next attempt ("already exists"): say what to do.
    if (existsSync(projectDir)) throw new Error(`${(error as Error).message}\n   ${pc.dim(`The incomplete project is in ./${name}. Delete it before trying again.`)}`);
    throw error;
  }
  if (brandProfile) {
    const images = await downloadBrandAssets(brandProfile, projectDir);
    applyBrand(brandProfile, projectDir, images.files);
    if (images.skipped.length) p.log.warn(`Brand images skipped:\n${images.skipped.join("\n")}`);
  }
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
  if (gitStep) await execute([gitStep], projectDir, { verbose: true });
  await reportInstall(ref, kit.version, sel, r.skills, VERSION);

  const next = [`cd ${name}`];
  if (Object.keys(r.env).length) next.push("cp .env.example .env   # and fill in the keys");
  next.push(...sel.agents.filter((a) => a in AGENT_COMMANDS).map((a) => AGENT_COMMANDS[a]!));
  p.note(next.join("\n"), "Next steps");
  if (failed.length) {
    p.log.warn(`${failed.length} step(s) failed. You can retry them by hand:\n${failed.map((s) => `  ${describe(s, projectDir)}`).join("\n")}`);
    p.outro(pc.yellow("Project created with warnings."));
  } else {
    p.outro(`${pc.green("Done.")} ${r.skills.length} ${r.skills.length === 1 ? "skill" : "skills"} installed for ${sel.agents.join(", ")}.`);
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
  // Flags are checked strictly (a missing requirement is an error, not a silent drop); the rest is pruned.
  const flags = Object.fromEntries([...explicit].map((id) => [id, sel.options[id] ?? []]));
  sel = selectionsFrom(kit, { base: sel, options: flags }, { requirements: "throw" }).selections;

  const added = listFlag(args, "skill") ?? [];
  for (const s of added) {
    if (!skillRefSchema.safeParse(s).success) throw new Error(`Invalid skill "${s}". Format: owner/repo@skill`);
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
        message: "Skills to install",
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
    for (const a of agents) if (!known.has(a)) p.log.warn(`Agent "${a}": skills will be installed, but ${BRAND.name} doesn't know how to configure its MCP.`);
    sel.agents = agents;
  } else if (interactive) {
    sel.agents = guard(
      await p.multiselect({
        message: "Which agents will you work with?",
        options: AGENTS.map((a) => ({ value: a.id, label: a.label })),
        initialValues: sel.agents,
        required: true,
      }),
    );
  }

  // `pnpm dlx <cli>` / `bunx <cli>` → that package manager; plain npx asks (or defaults to npm).
  const pm = args.flags.get("pm")?.[0] ?? pmFromUserAgent(process.env.npm_config_user_agent ?? "");
  if (pm) {
    if (!PACKAGE_MANAGERS.includes(pm as PackageManager)) throw new Error(`--pm must be one of ${PACKAGE_MANAGERS.join(", ")}`);
    sel.pm = pm as PackageManager;
  } else if (interactive && kit.packageManagers.length > 1) {
    sel.pm = guard(
      await p.select({
        message: "Package manager",
        options: kit.packageManagers.map((m) => ({ value: m, label: m })),
        initialValue: sel.pm,
      }),
    );
  }
  return sel;
}

function guard<T>(value: T): Exclude<T, symbol> {
  if (p.isCancel(value)) {
    p.cancel("Cancelled.");
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
