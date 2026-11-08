import { BRAND } from "./brand";
import { importAgentsMd, INSTRUCTION_STUBS, MCP_TARGETS, mergeEnv, upsertKitSection, type Merge } from "./agents";
import { LANGUAGE_CONVENTIONS } from "./conventions";
import { kitLanguage, languageLabel } from "./languages";
import { nodeRunner, packageManager, type PackageManager } from "./package-managers";
import { parseSkillRef, resolve, type Resolved, type Selections } from "./resolve";
import type { Kit, McpServer, WriteFile } from "./schema";
import { BRAND_ASSETS, brandLogo, type BrandAssetKind, type BrandProfile } from "./brand-profile";

/**
 * Path operations, injected so the planner runs in Node (CLI, with node:path)
 * and in the browser (website preview, with the POSIX defaults below).
 */
export interface PathOps {
  join: (...parts: string[]) => string;
  /** Like path.resolve(dir, p): absolute `p` wins. */
  resolve: (dir: string, p: string) => string;
  basename: (p: string) => string;
}

export const posixPaths: PathOps = {
  join: (...parts) => parts.filter(Boolean).join("/").replace(/\/+/g, "/").replace(/\/\.\//g, "/"),
  resolve: (dir, p) => (p.startsWith("/") ? p : posixPaths.join(dir, p)),
  basename: (p) => p.replace(/\/+$/, "").split("/").pop() ?? p,
};

export type Step =
  | { kind: "run"; title: string; command: string; cwd: string; optional?: boolean }
  | { kind: "copy"; title: string; from: string; to: string }
  | { kind: "write"; title: string; path: string; merge: Merge; optional?: boolean }
  | { kind: "git"; title: string; cwd: string }
  | BrandStep;

/**
 * Applying a brand profile: its images downloaded into the project, then BRAND.md, tokens, the CSS
 * variables and the AGENTS.md rules. One step, because where the CSS goes (the first global stylesheet
 * that exists) is only known once the base project has been created.
 */
export interface BrandStep {
  kind: "brand";
  title: string;
  cwd: string;
  /** "acme/web" or "./brand.json": what `--brand` received. */
  ref: string;
  /** The loaded profile (the CLI); absent where it isn't available (the website when logged out). */
  profile?: BrandProfile;
  /** The images it brings, by label ("Logo", "Favicon"…), for the plan. */
  images: string[];
}

/** What a plan needs to apply a brand: the ref, and the profile or just its image kinds when known. */
export interface PlanBrand {
  ref: string;
  profile?: BrandProfile | null;
  title?: string;
  images?: BrandAssetKind[];
}

/** The brand step for a project directory; also the whole plan of `brand <ref>` in an existing project. */
export function brandStep(brand: PlanBrand, cwd: string): BrandStep {
  const profile = brand.profile ?? undefined;
  const kinds = profile
    ? (Object.keys(BRAND_ASSETS) as BrandAssetKind[]).filter((k) => (k === "logo" ? brandLogo(profile) : profile.assets[k]))
    : (brand.images ?? []);
  const title = profile?.title ?? brand.title;
  return { kind: "brand", title: title ? `Apply the ${title} brand` : `Apply brand ${brand.ref}`, cwd, ref: brand.ref, ...(profile ? { profile } : {}), images: kinds.map((k) => BRAND_ASSETS[k].label) };
}

/** Variables available in kit commands and files: {{name}}, {{pm}}, {{pmx}}, {{ciSetup}}, {{opt.<id>}}. */
export function templateVars(sel: Selections, name: string): Record<string, string> {
  return {
    name,
    pm: sel.pm,
    pmx: packageManager(sel.pm).exec,
    ciSetup: packageManager(sel.pm).ciSetup ?? "",
    ...Object.fromEntries(Object.entries(sel.options).map(([k, v]) => [`opt.${k}`, v.join(",")])),
  };
}

/** Replaces {{var}}; unknown variables are left as they are. */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, key: string) => vars[key] ?? match);
}

/** `{pm} add` (or the kit's own command, e.g. `npx expo install`) for regular and dev dependencies. */
export function dependencySteps(o: {
  addCommand?: Kit["addCommand"];
  pm: PackageManager;
  dependencies: string[];
  devDependencies: string[];
  cwd: string;
  vars: Record<string, string>;
}): Step[] {
  const steps: Step[] = [];
  const { add: byPm } = packageManager(o.pm);
  const add = { deps: o.addCommand?.dependencies ?? byPm.deps, dev: o.addCommand?.devDependencies ?? byPm.dev };
  if (o.dependencies.length) {
    steps.push({
      kind: "run",
      title: "Add dependencies",
      command: fillTemplate(add.deps, { ...o.vars, packages: o.dependencies.map(shellQuote).join(" ") }),
      cwd: o.cwd,
    });
  }
  if (o.devDependencies.length) {
    steps.push({
      kind: "run",
      title: "Add dev dependencies",
      command: fillTemplate(add.dev, { ...o.vars, packages: o.devDependencies.map(shellQuote).join(" ") }),
      cwd: o.cwd,
    });
  }
  return steps;
}

/** One `skills add` per source repo: the skills CLI handles each agent's skill directory. */
export function skillSteps(o: { skills: string[]; agents: string[]; pm: PackageManager; cwd: string }): Step[] {
  const bySource = new Map<string, string[]>();
  for (const ref of o.skills) {
    const { source, skill } = parseSkillRef(ref);
    bySource.set(source, [...(bySource.get(source) ?? []), skill]);
  }
  return [...bySource].map(([source, skills]) => ({
    kind: "run" as const,
    title: `Install skills from ${source}`,
    command: `${nodeRunner(o.pm)} skills@latest add ${source} --skill ${skills.join(" ")} --agent ${o.agents.join(" ")} --yes`,
    cwd: o.cwd,
    // A missing or renamed skill shouldn't throw away an otherwise finished project.
    optional: true,
  }));
}

/** MCP servers in each agent's own config file (merged: existing servers are kept). */
export function mcpSteps(o: { mcp: Record<string, McpServer>; agents: string[]; projectDir: string; join: PathOps["join"] }): Step[] {
  const names = Object.keys(o.mcp);
  if (!names.length) return [];
  return o.agents.flatMap((agent) => {
    const target = MCP_TARGETS[agent];
    return target
      ? [{ kind: "write" as const, title: `Configure MCP for ${agent} (${names.join(", ")})`, path: o.join(o.projectDir, target.path), merge: target.merge(o.mcp) }]
      : [];
  });
}

export interface PlanInput {
  /** node:path in the CLI; POSIX helpers by default (browser). */
  paths?: PathOps;
  kit: Kit;
  kitDir: string;
  sel: Selections;
  /** Directory the project is created in (its parent must exist). */
  parentDir: string;
  name: string;
  git: boolean;
  /** --brand: applied after the kit's files and AGENTS.md, before the initial commit. */
  brand?: PlanBrand | null;
  /** The kit as the user typed it ("landing-next", "ana/landing"): where the README badge links to. */
  kitRef?: string;
}

export function buildPlan({ kit, kitDir, sel, parentDir, name, git, brand, kitRef, paths = posixPaths }: PlanInput): Step[] {
  const { join, basename } = paths;
  const resolvePath = paths.resolve;
  const r = resolve(kit, sel);
  const projectDir = join(parentDir, name);
  const vars = templateVars(sel, name);
  const fill = (template: string, extra: Record<string, string> = {}) => fillTemplate(template, { ...vars, ...extra });

  const steps: Step[] = [
    { kind: "run", title: "Create the base project", command: fill(kit.base.command), cwd: parentDir },
  ];
  if (kit.base.install) {
    steps.push({ kind: "run", title: "Install base dependencies", command: fill(kit.base.install), cwd: projectDir });
  }

  steps.push(...dependencySteps({ addCommand: kit.addCommand, pm: sel.pm, dependencies: r.dependencies, devDependencies: r.devDependencies, cwd: projectDir, vars }));

  for (const files of r.files) {
    // Absolute when inherited through `extends`; resolve() keeps those as they are.
    steps.push({ kind: "copy", title: `Copy files (${basename(files)})`, from: resolvePath(kitDir, files), to: projectDir });
  }

  for (const file of r.writeFiles) {
    steps.push({
      kind: "write",
      title: WRITE_TITLES[file.mode],
      path: join(projectDir, file.path),
      merge: applyWrite({ ...file, content: fill(file.content) }),
      // A patch whose anchor isn't there is reported at the end, not fatal.
      optional: true,
    });
  }

  // Setup commands (e.g. `shadcn init`) can fail on an unusual base project;
  // report them at the end instead of discarding the whole project.
  for (const command of r.postInstall) {
    steps.push({ kind: "run", title: "Set up", command: fill(command), cwd: projectDir, optional: true });
  }

  for (const command of kit.finalize) {
    steps.push({ kind: "run", title: "Finish the install", command: fill(command), cwd: projectDir });
  }

  steps.push(...skillSteps({ skills: r.skills, agents: sel.agents, pm: sel.pm, cwd: projectDir }));
  steps.push(...mcpSteps({ mcp: r.mcp, agents: sel.agents, projectDir, join }));

  if (Object.keys(r.env).length) {
    steps.push({ kind: "write", title: "Environment variables", path: join(projectDir, ".env.example"), merge: mergeEnv(r.env) });
  }

  steps.push({
    kind: "write",
    title: "Agent instructions",
    path: join(projectDir, "AGENTS.md"),
    merge: upsertKitSection(agentsSection(kit, r, sel.pm), kit.title),
  });
  for (const agent of sel.agents) {
    const stub = INSTRUCTION_STUBS[agent];
    if (stub) steps.push({ kind: "write", title: `Link ${stub} to AGENTS.md`, path: join(projectDir, stub), merge: importAgentsMd });
  }

  if (sel.badge !== false) {
    // Optional: a README the base project wrote in an unusual way must never stop the install.
    steps.push({ kind: "write", title: "Add the first-commit badge to README.md", path: join(projectDir, "README.md"), merge: addReadmeBadge(readmeBadge(kitRef ?? kit.name), name), optional: true });
  }
  if (brand) steps.push(brandStep(brand, projectDir));
  if (git) steps.push({ kind: "git", title: "Initial commit", cwd: projectDir });
  return steps;
}

/**
 * The kit section of AGENTS.md, written for the stack actually chosen: the language's conventions and
 * package manager, the skills grouped by the part of the stack they cover, MCP, setup tasks and the
 * rules of every chosen library.
 */
export function agentsSection(kit: Kit, r: Resolved, pm: PackageManager = kit.packageManagers[0] ?? "npm"): string {
  // Only what was picked: a list of "none" lines tells the agent nothing.
  const chosen = r.chosen
    .flatMap(({ optionId, choices }) => {
      const picked = choices.filter((c) => c.id !== "none");
      return picked.length ? [`- ${kit.options.find((o) => o.id === optionId)!.label}: ${picked.map((c) => c.label).join(", ")}`] : [];
    })
    .join("\n");
  const groups = skillGroups(kit, r);
  const parts = [
    `## Workspace kit: ${kit.name}`,
    `Project created with the \`${kit.name}\` kit from ${BRAND.name}. ${kit.description}`,
    chosen && `### Chosen stack\n\n${chosen}`,
    workingSection(kit, pm),
    groups.length &&
      `### Skills for this stack\n\nThe installed skills, grouped by the part of the stack they cover. Before working on one of these areas, read its skills: they hold the current, recommended way to do it.\n\n${groups
        .map((g) => `- **${g.title}**: ${g.skills.map((s) => `\`${parseSkillRef(s).skill}\``).join(", ")}`)
        .join("\n")}`,
    Object.keys(r.mcp).length &&
      `### MCP servers\n\n${Object.entries(r.mcp)
        .map(([name, s]) => `- \`${name}\`: ${"url" in s ? s.url : [s.command, ...s.args].join(" ")}`)
        .join("\n")}`,
    Object.keys(r.env).length && "### Environment\n\nThe required variables are in `.env.example`. Never commit `.env` to the repository.",
    r.setupTasks.length &&
      `### First steps\n\nWhen you start working on this project, go through these tasks. Do the ones that only depend on code, ask the user for what you need (keys, accounts) and tick each one off when it's done:\n\n${r.setupTasks.map((t) => `- [ ] ${t}`).join("\n")}`,
    ...r.instructions,
  ];
  return parts.filter(Boolean).join("\n\n");
}

/** Language, package manager and the language's conventions. */
function workingSection(kit: Kit, pm: PackageManager): string {
  const language = kitLanguage(kit);
  const add = packageManager(pm).add;
  // Managers without an "add" command (Maven, Gradle, Xcode) say where dependencies go instead.
  const manual = add.deps.match(/^echo 'Add \{\{packages\}\} to (.+?)' >&2/);
  const deps = manual
    ? `dependencies go in ${manual[1]}`
    : `add a dependency with \`${fillTemplate(add.deps, { packages: "<package>" })}\` (development only: \`${fillTemplate(add.dev, { packages: "<package>" })}\`)`;
  const rules = [`${languageLabel(language)} with ${pm}: ${deps}.`, ...LANGUAGE_CONVENTIONS[language]];
  return `### Working in this stack\n\n${rules.map((rule) => `- ${rule}`).join("\n")}`;
}

/**
 * The installed skills by where they came from: the kit itself (framework and language), then each
 * chosen library or option, then the rest (added by hand, the first-commit skill).
 */
export function skillGroups(kit: Kit, r: Resolved): { title: string; skills: string[] }[] {
  const installed = new Set(r.skills);
  const placed = new Set<string>();
  const take = (refs: string[]) =>
    refs.filter((ref) => {
      if (!installed.has(ref) || placed.has(ref)) return false;
      placed.add(ref);
      return true;
    });
  const groups = [{ title: `${kit.title} (framework and language)`, skills: take(kit.skills) }];
  for (const { optionId, choices } of r.chosen) {
    const option = kit.options.find((o) => o.id === optionId)!;
    for (const choice of choices) {
      // "Design pack: Design pack" → "Design pack".
      const title = choice.label.toLowerCase().includes(option.label.toLowerCase()) ? choice.label : `${option.label}: ${choice.label}`;
      groups.push({ title, skills: take(choice.skills) });
    }
  }
  groups.push({ title: "Other", skills: take(r.skills) });
  return groups.filter((g) => g.skills.length);
}

/** Quote package specs like `tailwindcss@^3.4.17` so the shell leaves them alone. */
function shellQuote(value: string): string {
  return /^[\w@./:=-]+$/.test(value) ? value : `'${value.replace(/'/g, `'\\''`)}'`;
}

export const WRITE_TITLES: Record<WriteFile["mode"], string> = {
  create: "Create file",
  append: "Append to",
  prepend: "Prepend to",
  "insert-before": "Insert into",
  "json-merge": "Merge into",
};

/** Applies one inline file from the kit or a library, idempotently. */
export function applyWrite(file: WriteFile): Merge {
  return (existing) => {
    const content = file.content.endsWith("\n") ? file.content : `${file.content}\n`;
    if (existing === undefined) {
      if (file.mode === "insert-before") throw new Error(`The file to insert into doesn't exist (${file.path})`);
      return content;
    }
    if (file.mode === "json-merge") {
      let current: unknown;
      try {
        current = JSON.parse(existing);
      } catch {
        throw new Error(`${file.path} isn't valid JSON (does it have comments?)`);
      }
      return `${JSON.stringify(mergeJson(current, JSON.parse(file.content)), null, 2)}\n`;
    }
    if (file.mode === "create" || existing.includes(file.content.trim())) return existing;
    switch (file.mode) {
      case "append":
        return `${existing.trimEnd()}\n\n${content}`;
      case "prepend":
        return `${content}${existing}`;
      case "insert-before": {
        const at = file.anchor ? existing.indexOf(file.anchor) : -1;
        if (at === -1) throw new Error(`Couldn't find "${file.anchor}" in ${file.path}`);
        return existing.slice(0, at) + content + existing.slice(at);
      }
    }
  };
}

/**
 * Deep merge that only adds: keys missing in `current` are copied from
 * `patch`, existing values win, and arrays get the patch items they don't have.
 * Re-applying it is a no-op, so `update` can run it again safely.
 */
export function mergeJson(current: unknown, patch: unknown): unknown {
  if (Array.isArray(current) && Array.isArray(patch)) {
    const seen = new Set(current.map((x) => JSON.stringify(x)));
    return [...current, ...patch.filter((x) => !seen.has(JSON.stringify(x)))];
  }
  if (isPlainObject(current) && isPlainObject(patch)) {
    const out: Record<string, unknown> = { ...current };
    for (const [key, value] of Object.entries(patch)) out[key] = key in current ? mergeJson(current[key], value) : value;
    return out;
  }
  return current === undefined ? patch : current;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const BADGE_START = "<!-- first-commit:badge -->";
const BADGE_END = "<!-- /first-commit:badge -->";

/**
 * The "Started with first-commit" badge, linking to the kit the project came from (`?ref=badge`
 * tells the site where the visit came from). Local kits (paths) link to the site itself.
 */
export function readmeBadge(kitRef: string): string {
  const local = kitRef.startsWith(".") || kitRef.startsWith("/") || /^[a-z]:[\\/]/i.test(kitRef);
  const href = local ? `${BRAND.siteUrl}/?ref=badge` : `${BRAND.siteUrl}/kits/${kitRef}?ref=badge`;
  return `[![Started with ${BRAND.name}](${BRAND.siteUrl}/badge/started.svg)](${href})`;
}

/**
 * Puts the badge under the README's title (where badges go), in a block it can find again: an
 * existing block is replaced, never duplicated. Without a README it creates one with the project name.
 */
export function addReadmeBadge(badge: string, title: string): Merge {
  const block = `${BADGE_START}\n${badge}\n${BADGE_END}`;
  return (existing) => {
    if (!existing?.trim()) return `# ${title}\n\n${block}\n`;
    const start = existing.indexOf(BADGE_START);
    const end = existing.indexOf(BADGE_END);
    if (start !== -1 && end !== -1) return existing.slice(0, start) + block + existing.slice(end + BADGE_END.length);
    const lines = existing.split("\n");
    const heading = lines.findIndex((l) => /^#\s/.test(l));
    if (heading === -1) return `${block}\n\n${existing}`;
    return [...lines.slice(0, heading + 1), "", block, ...lines.slice(heading + 1)].join("\n");
  };
}
