import { BRAND, KITS_SKILL, KITS_SKILL_PUBLISHED } from "./brand";
import type { PackageManager } from "./package-managers";
import type { Choice, Kit, McpServer, WriteFile } from "./schema";

import { DEFAULT_AGENTS } from "./catalog";

export { AGENTS, DEFAULT_AGENTS, type AgentId } from "./catalog";

export { PACKAGE_MANAGER_IDS as PACKAGE_MANAGERS } from "./package-managers";

export interface Selections {
  /** option id → selected choice ids */
  options: Record<string, string[]>;
  /** Skills added on top of the kit's (owner/repo@skill). */
  addSkills: string[];
  /** Kit skills the user switched off. */
  removeSkills: string[];
  agents: string[];
  pm: PackageManager;
  /** false: no "Started with first-commit" badge in README.md (`--no-badge`). On by default. */
  badge?: boolean;
}

export interface Resolved {
  dependencies: string[];
  devDependencies: string[];
  skills: string[];
  mcp: Record<string, McpServer>;
  env: Record<string, string>;
  files: string[];
  instructions: string[];
  postInstall: string[];
  writeFiles: WriteFile[];
  setupTasks: string[];
  /** option id → chosen choices, in kit order */
  chosen: { optionId: string; choices: Choice[] }[];
}

export function defaultSelections(kit: Kit): Selections {
  return pruneSelections(kit, {
    options: Object.fromEntries(
      kit.options.map((o) => [o.id, Array.isArray(o.default) ? [...o.default] : [o.default]]),
    ),
    addSkills: [],
    removeSkills: [],
    agents: [...DEFAULT_AGENTS],
    pm: kit.packageManagers[0] ?? "npm",
  });
}

/** Every skill the kit can install with some combination of choices. */
export function allKitSkills(kit: Kit): string[] {
  const skills = [...kit.skills];
  for (const o of kit.options) for (const c of o.choices) skills.push(...c.skills);
  return unique(skills);
}

export function resolve(kit: Kit, sel: Selections): Resolved {
  const chosen = kit.options.map((option) => {
    const ids = sel.options[option.id] ?? [];
    return { optionId: option.id, choices: option.choices.filter((c) => ids.includes(c.id)) };
  });
  const parts = [kit, ...chosen.flatMap((c) => c.choices)];
  const removed = new Set(sel.removeSkills);

  return {
    dependencies: unique(parts.flatMap((p) => p.dependencies)),
    devDependencies: unique(parts.flatMap((p) => p.devDependencies)),
    // Every kit also installs the kits skill, so the agent knows `update` and `add` later.
    skills: unique([...parts.flatMap((p) => p.skills), ...(KITS_SKILL_PUBLISHED ? [KITS_SKILL] : []), ...sel.addSkills]).filter((s) => !removed.has(s)),
    mcp: Object.assign({}, ...parts.map((p) => p.mcp)),
    env: Object.assign({}, ...parts.map((p) => p.env)),
    files: parts.flatMap((p) => (p.files === undefined ? [] : ([] as string[]).concat(p.files))),
    instructions: parts.flatMap((p) => (p.instructions ? [p.instructions] : [])),
    postInstall: parts.flatMap((p) => p.postInstall),
    writeFiles: parts.flatMap((p) => p.writeFiles),
    setupTasks: unique(parts.flatMap((p) => p.setupTasks)),
    chosen,
  };
}

/** Whether a choice's `requires` is satisfied by the current selections. */
export function requirementsMet(choice: Choice, sel: Selections): boolean {
  return Object.entries(choice.requires ?? {}).every(([optionId, ids]) =>
    (sel.options[optionId] ?? []).some((id) => ids.includes(id)),
  );
}

/**
 * Drops choices whose requirements no longer hold (e.g. switching the
 * framework to Vue removes React-only libraries), in kit order so a pruned
 * choice can cascade. Options in `keep` were set explicitly and are left for
 * validateSelections to report.
 */
export function pruneSelections(kit: Kit, sel: Selections, keep: ReadonlySet<string> = new Set()): Selections {
  const next: Selections = { ...sel, options: { ...sel.options } };
  for (const option of kit.options) {
    if (keep.has(option.id)) continue;
    const ids = next.options[option.id] ?? [];
    const valid = ids.filter((id) => {
      const choice = option.choices.find((c) => c.id === id);
      return choice && requirementsMet(choice, next);
    });
    if (option.type === "select" && !valid.length) {
      // Fall back to the first choice that is allowed ("none" when there is one).
      const fallback = option.choices.find((c) => requirementsMet(c, next));
      next.options[option.id] = fallback ? [fallback.id] : [];
    } else {
      next.options[option.id] = valid;
    }
  }
  return next;
}

/** Throws a readable error when selections don't match the kit. */
export function validateSelections(kit: Kit, sel: Selections): void {
  for (const [id, values] of Object.entries(sel.options)) {
    const option = kit.options.find((o) => o.id === id);
    if (!option) throw new Error(`Unknown option "--${id}". Available: ${kit.options.map((o) => o.id).join(", ") || "none"}`);
    if (option.type === "select" && values.length !== 1) throw new Error(`"--${id}" takes exactly one value`);
    for (const v of values) {
      const choice = option.choices.find((c) => c.id === v);
      if (!choice) {
        throw new Error(`Unknown value "${v}" for --${id}. Choose one of: ${option.choices.map((c) => c.id).join(", ")}`);
      }
      if (!requirementsMet(choice, sel)) {
        const needs = Object.entries(choice.requires ?? {}).map(([o, ids]) => `--${o} ${ids.join("|")}`).join(" and ");
        throw new Error(`"${v}" (--${id}) needs ${needs}`);
      }
    }
  }
  if (!kit.packageManagers.includes(sel.pm)) {
    throw new Error(`This kit supports ${kit.packageManagers.join(", ")}, not ${sel.pm}`);
  }
}

/**
 * The `npx create-first-commit init ...` command for a set of selections. Only flags that
 * differ from the kit defaults are included, so the default command stays short.
 */
export function buildInitCommand(kitRef: string, kit: Kit, sel: Selections, projectName?: string, brandRef?: string): string {
  // `init` is the CLI's default command, like create-vite: npx create-first-commit@latest landing-next
  return ["npx", `${BRAND.cli}@latest`, ...initArgs(kitRef, kit, sel, projectName).slice(1), ...(brandRef ? ["--brand", brandRef] : [])].join(" ");
}

/** Arguments of `init` for these selections; only what differs from the kit's defaults. */
export function initArgs(kitRef: string, kit: Kit, sel: Selections, projectName?: string): string[] {
  const defaults = defaultSelections(kit);
  const args = ["init", kitRef];
  if (projectName) args.push(projectName);

  for (const option of kit.options) {
    const value = sel.options[option.id] ?? [];
    const def = defaults.options[option.id] ?? [];
    if (!sameSet(value, def)) args.push(`--${option.id}`, value.length ? value.join(",") : "none");
  }
  for (const s of sel.addSkills) args.push("--skill", s);
  for (const s of sel.removeSkills) args.push("--no-skill", s);
  if (!sameSet(sel.agents, defaults.agents)) args.push("--agent", sel.agents.join(","));
  if (sel.pm !== defaults.pm) args.push("--pm", sel.pm);
  if (sel.badge === false) args.push("--no-badge");
  return args;
}

export function parseSkillRef(ref: string): { source: string; skill: string } {
  const at = ref.lastIndexOf("@");
  return { source: ref.slice(0, at), skill: ref.slice(at + 1) };
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}
