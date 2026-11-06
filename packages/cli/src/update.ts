import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

import * as p from "@clack/prompts";
import {
  agentsSection,
  applyWrite,
  dependencySteps,
  fillTemplate,
  importAgentsMd,
  INSTRUCTION_STUBS,
  listDiff,
  mcpSteps,
  mergeEnv,
  resolve as resolveKit,
  selectionsFrom,
  skillSteps,
  templateVars,
  upsertKitSection,
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
  if (!lock) throw new Error("No kits.lock in this folder. Was this project created from a kit?");
  if (!lock.kit) throw new Error("This project wasn't created from a kit: use `add` to add pieces from the catalog.");

  p.intro(pc.bgWhite(pc.black(" update ")));
  const target = args.positionals[0];
  const loaded = await loadKit(target ? `${lock.kit}@${target}` : lock.kit);
  const { kit } = loaded;
  if (kit.version === lock.version && !args.switches.has("force")) {
    p.outro(`${lock.kit} is already on the latest version (${kit.version}).`);
    return;
  }

  // Keep the user's choices; options the new version added take their defaults.
  const { selections: sel } = selectionsFrom(kit, { options: lock.options, agents: lock.agents, pm: lock.pm }, { requirements: "prune", unknown: "ignore" });
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
    } else if (action === "skip-deleted") skipped.push(`${path} (you deleted it; not restored)`);
    else if (action === "skip-modified") skipped.push(`${path} (you modified it)`);
  };
  for (const file of r.writeFiles) {
    const content = fillTemplate(file.content, vars);
    if (file.mode === "create") {
      const body = content.endsWith("\n") ? content : `${content}\n`;
      consider(file.path, sha(body), () => ({ kind: "write", title: "Update file", path: join(dir, file.path), merge: () => body }));
    } else {
      // Patches to the user's own files are idempotent: applied only if missing.
      fileSteps.push({ kind: "write", title: "Check", path: join(dir, file.path), merge: applyWrite({ ...file, content }), optional: true });
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
    ...(Object.keys(r.env).length ? [{ kind: "write" as const, title: "Environment variables", path: join(dir, ".env.example"), merge: mergeEnv(r.env) }] : []),
    { kind: "write", title: "Agent instructions", path: join(dir, "AGENTS.md"), merge: upsertKitSection(agentsSection(kit, r), kit.title) },
    ...sel.agents.flatMap((a) =>
      INSTRUCTION_STUBS[a] ? [{ kind: "write" as const, title: `Link ${INSTRUCTION_STUBS[a]} to AGENTS.md`, path: join(dir, INSTRUCTION_STUBS[a]!), merge: importAgentsMd }] : [],
    ),
  ];

  const summary = [
    `${lock.version} → ${pc.bold(kit.version)}`,
    deps.added.length + devDeps.added.length && `new dependencies: ${[...deps.added, ...devDeps.added].join(", ")}`,
    skills.added.length && `new skills: ${skills.added.join(", ")}`,
    skills.removed.length && pc.dim(`skills the kit no longer uses (still installed): ${skills.removed.join(", ")}`),
    deps.removed.length + devDeps.removed.length && pc.dim(`dependencies the kit no longer uses (not uninstalled): ${[...deps.removed, ...devDeps.removed].join(", ")}`),
    droppedOptions.length && pc.yellow(`options changed by the new version: ${droppedOptions.join(", ")}`),
    skipped.length && pc.yellow(`files left untouched:\n  ${skipped.join("\n  ")}`),
    r.postInstall.length && pc.dim("the kit's setup commands aren't run again"),
  ].filter(Boolean);
  p.note(summary.join("\n"), `${lock.kit}`);
  p.note(steps.map((s, i) => `${pc.dim(`${i + 1}.`)} ${describe(s, dir)}`).join("\n"), "Plan");

  if (args.switches.has("dry-run")) {
    p.outro("Dry run: nothing was changed.");
    return;
  }
  if (interactive && !guard(await p.confirm({ message: "Apply the update?" }))) {
    p.cancel("Cancelado.");
    return;
  }

  const failed = await execute(steps, dir, { verbose: args.switches.has("verbose") });
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
  if (failed.length) p.log.warn(`${failed.length} step(s) failed:\n${failed.map((s) => `  ${describe(s, dir)}`).join("\n")}`);
  p.outro(`${pc.green("Updated")} to ${lock.kit}@${kit.version}. Review the changes with git diff.`);
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
