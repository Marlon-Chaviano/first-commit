import { importAgentsMd, INSTRUCTION_STUBS, MCP_TARGETS, mergeEnv, upsertKitSection, type Merge } from "./agents";
import { parseSkillRef, resolve, type PackageManager, type Selections } from "./resolve";
import type { Kit, McpServer, WriteFile } from "./schema";

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
  | { kind: "git"; title: string; cwd: string };

/** {{pmx}}: run a package's binary without installing it. */
const PMX: Record<PackageManager, string> = {
  npm: "npx",
  pnpm: "pnpm dlx",
  bun: "bunx",
  deno: "deno run -A",
  uv: "uvx",
  pip: "pipx run",
  go: "go run",
  swift: "swift run",
  bundler: "bundle exec",
  composer: "composer exec",
  maven: "./mvnw",
  cargo: "cargo run",
};
/** The skills CLI is a Node tool: Python and Go projects run it with npx. */
const NODE_RUNNER: Record<PackageManager, string> = {
  npm: "npx",
  pnpm: "pnpm dlx",
  bun: "bunx",
  deno: "npx",
  uv: "npx",
  pip: "npx",
  go: "npx",
  swift: "npx",
  bundler: "npx",
  composer: "npx",
  maven: "npx",
  cargo: "npx",
};
const ADD: Record<PackageManager, { deps: string; dev: string }> = {
  npm: { deps: "npm install {{packages}}", dev: "npm install -D {{packages}}" },
  pnpm: { deps: "pnpm add {{packages}}", dev: "pnpm add -D {{packages}}" },
  bun: { deps: "bun add {{packages}}", dev: "bun add -d {{packages}}" },
  uv: { deps: "uv add {{packages}}", dev: "uv add --dev {{packages}}" },
  // Kits for pip create a virtualenv in .venv (see the FastAPI kit).
  pip: { deps: ".venv/bin/pip install {{packages}}", dev: ".venv/bin/pip install {{packages}}" },
  go: { deps: "go get {{packages}}", dev: "go get -tool {{packages}}" },
  deno: { deps: "deno add {{packages}}", dev: "deno add --dev {{packages}}" },
  bundler: { deps: "bundle add {{packages}}", dev: "bundle add {{packages}} --group development,test" },
  composer: { deps: "composer require {{packages}}", dev: "composer require --dev {{packages}}" },
  cargo: { deps: "cargo add {{packages}}", dev: "cargo add --dev {{packages}}" },
  // Maven has no "add" command: dependencies go in pom.xml.
  maven: {
    deps: "echo 'Añade {{packages}} a <dependencies> en pom.xml' >&2 && exit 1",
    dev: "echo 'Añade {{packages}} a <dependencies> en pom.xml (scope test)' >&2 && exit 1",
  },
  // Xcode projects (XcodeGen) declare Swift packages in project.yml; there's no CLI to add them.
  swift: {
    deps: "echo 'Añade {{packages}} a packages: en project.yml y ejecuta xcodegen generate' >&2 && exit 1",
    dev: "echo 'Añade {{packages}} a packages: en project.yml y ejecuta xcodegen generate' >&2 && exit 1",
  },
};

/** GitHub Actions steps that make the package manager available (npm comes with setup-node). */
const CI_SETUP: Partial<Record<PackageManager, string>> = {
  pnpm: "      - uses: pnpm/action-setup@v4\n        with:\n          version: 10\n",
  bun: "      - uses: oven-sh/setup-bun@v2\n",
};

/** Variables available in kit commands and files: {{name}}, {{pm}}, {{pmx}}, {{ciSetup}}, {{opt.<id>}}. */
export function templateVars(sel: Selections, name: string): Record<string, string> {
  return {
    name,
    pm: sel.pm,
    pmx: PMX[sel.pm],
    ciSetup: CI_SETUP[sel.pm] ?? "",
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
  const add = { deps: o.addCommand?.dependencies ?? ADD[o.pm].deps, dev: o.addCommand?.devDependencies ?? ADD[o.pm].dev };
  if (o.dependencies.length) {
    steps.push({
      kind: "run",
      title: "Añadir dependencias",
      command: fillTemplate(add.deps, { ...o.vars, packages: o.dependencies.map(shellQuote).join(" ") }),
      cwd: o.cwd,
    });
  }
  if (o.devDependencies.length) {
    steps.push({
      kind: "run",
      title: "Añadir dependencias de desarrollo",
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
    title: `Instalar skills de ${source}`,
    command: `${NODE_RUNNER[o.pm]} skills@latest add ${source} --skill ${skills.join(" ")} --agent ${o.agents.join(" ")} --yes`,
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
      ? [{ kind: "write" as const, title: `Configurar MCP para ${agent} (${names.join(", ")})`, path: o.join(o.projectDir, target.path), merge: target.merge(o.mcp) }]
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
}

export function buildPlan({ kit, kitDir, sel, parentDir, name, git, paths = posixPaths }: PlanInput): Step[] {
  const { join, basename } = paths;
  const resolvePath = paths.resolve;
  const r = resolve(kit, sel);
  const projectDir = join(parentDir, name);
  const vars = templateVars(sel, name);
  const fill = (template: string, extra: Record<string, string> = {}) => fillTemplate(template, { ...vars, ...extra });

  const steps: Step[] = [
    { kind: "run", title: "Crear el proyecto base", command: fill(kit.base.command), cwd: parentDir },
  ];
  if (kit.base.install) {
    steps.push({ kind: "run", title: "Instalar dependencias base", command: fill(kit.base.install), cwd: projectDir });
  }

  steps.push(...dependencySteps({ addCommand: kit.addCommand, pm: sel.pm, dependencies: r.dependencies, devDependencies: r.devDependencies, cwd: projectDir, vars }));

  for (const files of r.files) {
    // Absolute when inherited through `extends`; resolve() keeps those as they are.
    steps.push({ kind: "copy", title: `Copiar archivos (${basename(files)})`, from: resolvePath(kitDir, files), to: projectDir });
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
    steps.push({ kind: "run", title: "Configurar", command: fill(command), cwd: projectDir, optional: true });
  }

  steps.push(...skillSteps({ skills: r.skills, agents: sel.agents, pm: sel.pm, cwd: projectDir }));
  steps.push(...mcpSteps({ mcp: r.mcp, agents: sel.agents, projectDir, join }));

  if (Object.keys(r.env).length) {
    steps.push({ kind: "write", title: "Variables de entorno", path: join(projectDir, ".env.example"), merge: mergeEnv(r.env) });
  }

  steps.push({
    kind: "write",
    title: "Instrucciones para el agente",
    path: join(projectDir, "AGENTS.md"),
    merge: upsertKitSection(agentsSection(kit, r), kit.title),
  });
  for (const agent of sel.agents) {
    const stub = INSTRUCTION_STUBS[agent];
    if (stub) steps.push({ kind: "write", title: `Enlazar ${stub} con AGENTS.md`, path: join(projectDir, stub), merge: importAgentsMd });
  }

  if (git) steps.push({ kind: "git", title: "Commit inicial", cwd: projectDir });
  return steps;
}

/** The kit section of AGENTS.md (stack, skills, MCP, setup tasks, rules). */
export function agentsSection(kit: Kit, r: ReturnType<typeof resolve>): string {
  const chosen = r.chosen
    .map(({ optionId, choices }) => {
      const option = kit.options.find((o) => o.id === optionId)!;
      return `- ${option.label}: ${choices.map((c) => c.label).join(", ") || "ninguno"}`;
    })
    .join("\n");
  const parts = [
    `## Workspace kit: ${kit.name}`,
    `Proyecto creado con el kit \`${kit.name}\` de kits. ${kit.description}`,
    chosen && `### Stack elegido\n\n${chosen}`,
    r.skills.length &&
      `### Skills instalados\n\nUsa estos skills cuando la tarea encaje con ellos:\n\n${r.skills.map((s) => `- \`${s}\``).join("\n")}`,
    Object.keys(r.mcp).length &&
      `### Servidores MCP\n\n${Object.entries(r.mcp)
        .map(([name, s]) => `- \`${name}\`: ${"url" in s ? s.url : [s.command, ...s.args].join(" ")}`)
        .join("\n")}`,
    Object.keys(r.env).length && "### Entorno\n\nLas variables necesarias están en `.env.example`. Nunca subas `.env` al repositorio.",
    r.setupTasks.length &&
      `### Primeros pasos\n\nAl empezar a trabajar en este proyecto, revisa estas tareas. Haz las que dependan solo del código, pide al usuario lo que necesite (claves, cuentas) y marca cada una al terminarla:\n\n${r.setupTasks.map((t) => `- [ ] ${t}`).join("\n")}`,
    ...r.instructions,
  ];
  return parts.filter(Boolean).join("\n\n");
}

/** Quote package specs like `tailwindcss@^3.4.17` so the shell leaves them alone. */
function shellQuote(value: string): string {
  return /^[\w@./:=-]+$/.test(value) ? value : `'${value.replace(/'/g, `'\\''`)}'`;
}

export const WRITE_TITLES: Record<WriteFile["mode"], string> = {
  create: "Crear archivo",
  append: "Añadir a",
  prepend: "Añadir al inicio de",
  "insert-before": "Insertar en",
  "json-merge": "Completar",
};

/** Applies one inline file from the kit or a library, idempotently. */
export function applyWrite(file: WriteFile): Merge {
  return (existing) => {
    const content = file.content.endsWith("\n") ? file.content : `${file.content}\n`;
    if (existing === undefined) {
      if (file.mode === "insert-before") throw new Error(`No existe el archivo donde insertar (${file.path})`);
      return content;
    }
    if (file.mode === "json-merge") {
      let current: unknown;
      try {
        current = JSON.parse(existing);
      } catch {
        throw new Error(`${file.path} no es JSON válido (¿tiene comentarios?)`);
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
        if (at === -1) throw new Error(`No se encontró "${file.anchor}" en ${file.path}`);
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
