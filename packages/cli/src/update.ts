import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

import * as p from "@clack/prompts";
import {
  agentsSection,
  applyWrite,
  defaultSelections,
  dependencySteps,
  fillTemplate,
  importAgentsMd,
  INSTRUCTION_STUBS,
  listDiff,
  mcpSteps,
  mergeEnv,
  pruneSelections,
  resolve as resolveKit,
  skillSteps,
  templateVars,
  upsertKitSection,
  type Selections,
  type Step,
} from "@kits/schema";
import pc from "picocolors";

import type { ParsedArgs } from "./args";
import { describe, execute } from "./exec";
import { hashFile, readLock, walk, writeLock } from "./lockfile";
import { loadKit } from "./registry";
import { reportEvent } from "./telemetry";

const sha = (content: string) => createHash("sha256").update(content).digest("hex");

/**
 * `create-first-commit update [version]` — brings a project up to the latest version of its
 * kit: new dependencies, skills, MCP servers, env vars, rules in AGENTS.md and
 * kit-managed files the user hasn't edited. Never re-runs setup commands.
 */
export async function update(args: ParsedArgs, guard: <T>(v: T) => Exclude<T, symbol>, cliVersion: string): Promise<void> {
  const dir = resolve(args.flags.get("dir")?.[0] ?? ".");
  const interactive = Boolean(process.stdin.isTTY) && !args.switches.has("yes");
  const lock = await readLock(dir);
  if (!lock) throw new Error("No hay kits.lock en esta carpeta. ¿Es un proyecto creado con un kit?");
  if (!lock.kit) throw new Error("Este proyecto no se creó con un kit: usa `add` para añadir piezas del catálogo.");

  p.intro(pc.bgCyan(pc.black(" update ")));
  const target = args.positionals[0];
  const loaded = await loadKit(target ? `${lock.kit}@${target}` : lock.kit);
  const { kit } = loaded;
  if (kit.version === lock.version && !args.switches.has("force")) {
    p.outro(`${lock.kit} ya está en la última versión (${kit.version}).`);
    return;
  }

  // Keep the user's choices; options the new version added take their defaults.
  const defaults = defaultSelections(kit);
  const sel: Selections = pruneSelections(kit, {
    ...defaults,
    options: { ...defaults.options, ...lock.options },
    agents: lock.agents,
    pm: lock.pm,
  });
  const r = resolveKit(kit, sel);
  const vars = templateVars(sel, basename(dir));

  const deps = listDiff(lock.dependencies, r.dependencies);
  const devDeps = listDiff(lock.devDependencies, r.devDependencies);
  const skills = listDiff(lock.skills, r.skills);
  const droppedOptions = Object.keys(lock.options).filter(
    (id) => JSON.stringify(lock.options[id]) !== JSON.stringify(sel.options[id]),
  );

  // Kit-managed files: update only what the user hasn't touched.
  const managed = { ...lock.managedFiles };
  const skipped: string[] = [];
  const fileSteps: Step[] = [];
  const consider = (path: string, newHash: string, step: () => Step) => {
    const full = join(dir, path);
    const action = fileAction(existsSync(full) ? hashFile(full) : null, lock.managedFiles[path], newHash);
    if (action === "write") {
      fileSteps.push(step());
      managed[path] = newHash;
    } else if (action === "skip-deleted") skipped.push(`${path} (lo borraste; no se restaura)`);
    else if (action === "skip-modified") skipped.push(`${path} (modificado por ti)`);
  };
  for (const file of r.writeFiles) {
    const content = fillTemplate(file.content, vars);
    if (file.mode === "create") {
      const body = content.endsWith("\n") ? content : `${content}\n`;
      consider(file.path, sha(body), () => ({ kind: "write", title: "Actualizar archivo", path: join(dir, file.path), merge: () => body }));
    } else {
      // Patches to the user's own files are idempotent: applied only if missing.
      fileSteps.push({ kind: "write", title: "Revisar", path: join(dir, file.path), merge: applyWrite({ ...file, content }), optional: true });
    }
  }
  for (const folder of r.files) {
    const source = resolve(loaded.dir, folder);
    if (!existsSync(source)) continue;
    for (const file of walk(source)) {
      const path = relative(source, file).split("\\").join("/");
      consider(path, hashFile(file), () => ({ kind: "copy", title: `Actualizar ${path}`, from: file, to: join(dir, path) }));
    }
  }

  const steps: Step[] = [
    ...dependencySteps({ addCommand: kit.addCommand, pm: sel.pm, dependencies: deps.added, devDependencies: devDeps.added, cwd: dir, vars }),
    ...fileSteps,
    ...skillSteps({ skills: skills.added, agents: sel.agents, pm: sel.pm, cwd: dir }),
    ...mcpSteps({ mcp: r.mcp, agents: sel.agents, projectDir: dir, join }),
    ...(Object.keys(r.env).length ? [{ kind: "write" as const, title: "Variables de entorno", path: join(dir, ".env.example"), merge: mergeEnv(r.env) }] : []),
    { kind: "write", title: "Instrucciones para el agente", path: join(dir, "AGENTS.md"), merge: upsertKitSection(agentsSection(kit, r), kit.title) },
    ...sel.agents.flatMap((a) =>
      INSTRUCTION_STUBS[a] ? [{ kind: "write" as const, title: `Enlazar ${INSTRUCTION_STUBS[a]} con AGENTS.md`, path: join(dir, INSTRUCTION_STUBS[a]!), merge: importAgentsMd }] : [],
    ),
  ];

  const summary = [
    `${lock.version} → ${pc.bold(kit.version)}`,
    deps.added.length + devDeps.added.length && `dependencias nuevas: ${[...deps.added, ...devDeps.added].join(", ")}`,
    skills.added.length && `skills nuevos: ${skills.added.join(", ")}`,
    skills.removed.length && pc.dim(`skills que el kit ya no usa (siguen instalados): ${skills.removed.join(", ")}`),
    deps.removed.length + devDeps.removed.length && pc.dim(`dependencias que el kit ya no usa (no se desinstalan): ${[...deps.removed, ...devDeps.removed].join(", ")}`),
    droppedOptions.length && pc.yellow(`opciones que cambian por la nueva versión: ${droppedOptions.join(", ")}`),
    skipped.length && pc.yellow(`archivos que no se tocan:\n  ${skipped.join("\n  ")}`),
    r.postInstall.length && pc.dim("los comandos de configuración del kit no se vuelven a ejecutar"),
  ].filter(Boolean);
  p.note(summary.join("\n"), `${lock.kit}`);
  p.note(steps.map((s, i) => `${pc.dim(`${i + 1}.`)} ${describe(s, dir)}`).join("\n"), "Plan");

  if (args.switches.has("dry-run")) {
    p.outro("Dry run: no se ha cambiado nada.");
    return;
  }
  if (interactive && !guard(await p.confirm({ message: "¿Aplicar la actualización?" }))) {
    p.cancel("Cancelado.");
    return;
  }

  const failed = await execute(steps, dir);
  await writeLock(dir, {
    ...lock,
    version: kit.version,
    options: sel.options,
    skills: r.skills,
    dependencies: [...new Set([...lock.dependencies, ...r.dependencies])],
    devDependencies: [...new Set([...lock.devDependencies, ...r.devDependencies])],
    managedFiles: managed,
  });
  await reportEvent("update", lock.kit, kit.version, sel, r.skills, cliVersion);
  if (failed.length) p.log.warn(`${failed.length} paso(s) fallaron:\n${failed.map((s) => `  ${describe(s, dir)}`).join("\n")}`);
  p.outro(`${pc.green("Actualizado")} a ${lock.kit}@${kit.version}. Revisa los cambios con git diff.`);
}

/**
 * What `update` does with one kit-managed file. It only writes when the file is
 * missing and was never recorded, or when it's exactly as the kit left it.
 */
export function fileAction(
  currentHash: string | null,
  recordedHash: string | undefined,
  newHash: string,
): "write" | "unchanged" | "skip-deleted" | "skip-modified" {
  if (currentHash === null) return recordedHash ? "skip-deleted" : "write";
  if (currentHash === newHash) return "unchanged";
  return recordedHash && currentHash === recordedHash ? "write" : "skip-modified";
}
