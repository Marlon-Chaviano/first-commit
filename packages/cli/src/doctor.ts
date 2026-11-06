import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { cliCommand, parseSkillRef, type KitsLock } from "@kits/schema";
import pc from "picocolors";

import { api } from "./api";
import type { ParsedArgs } from "./args";
import { detectFramework } from "./create/frameworks";
import { installedLibraries, readDeps } from "./create/detect";
import { readLock } from "./lockfile";
import { loadCatalog, loadKit } from "./registry";

export interface Finding {
  level: "error" | "warning" | "info";
  check: string;
  message: string;
  fix?: string;
}

/** Where each agent reads project skills (the skills CLI's layout). */
const SKILL_DIRS: Record<string, string> = { "claude-code": ".claude/skills" };
const skillDir = (agent: string) => SKILL_DIRS[agent] ?? ".agents/skills";

/**
 * `create-first-commit doctor [--json]` — checks the project still follows its kit: one
 * component library, the chosen animation libraries, env vars set, skills
 * installed for every agent, managed files present, kit up to date.
 * Exit code 1 when there are errors, so it can run in CI or pre-commit.
 */
export async function doctor(args: ParsedArgs): Promise<void> {
  const dir = resolve(args.flags.get("dir")?.[0] ?? ".");
  const lock = await readLock(dir);
  const findings = await diagnose(dir, lock, !args.switches.has("offline"));

  if (args.switches.has("json")) {
    console.log(JSON.stringify({ ok: !findings.some((f) => f.level === "error"), kit: lock?.kit ?? null, version: lock?.version ?? null, findings }, null, 2));
  } else {
    console.log(`\n${pc.bold("doctor")} ${pc.dim(lock?.kit ? `${lock.kit}@${lock.version}` : "project without kits.lock")}\n`);
    if (!findings.length) console.log(`${pc.green("✓")} All good.`);
    for (const f of findings) {
      const icon = f.level === "error" ? pc.red("✗") : f.level === "warning" ? pc.yellow("!") : pc.cyan("i");
      console.log(`${icon} ${pc.dim(`[${f.check}]`)} ${f.message}${f.fix ? `\n    ${pc.dim("→")} ${f.fix}` : ""}`);
    }
    console.log();
  }
  if (findings.some((f) => f.level === "error")) process.exitCode = 1;
}

export async function diagnose(dir: string, lock: KitsLock | null, online = true): Promise<Finding[]> {
  const findings: Finding[] = [];
  if (!lock) {
    findings.push({
      level: "info",
      check: "kits.lock",
      message: "This project has no kits.lock: only environment variables are checked.",
      fix: cliCommand("add <library>") + " creates one",
    });
  }

  // Libraries: the AGENTS.md rules say "only these".
  if (existsSync(join(dir, "package.json")) && lock) {
    const deps = readDeps(dir);
    const framework = detectFramework(deps);
    const installed = installedLibraries(dir, await loadCatalog(), framework?.frameworks ?? [], deps);
    const chosen = new Set([...Object.values(lock.options).flat(), ...lock.added.map((a) => a.id)]);
    const components = installed.components.filter((l) => !chosen.has(l.id));
    if (components.length && installed.components.some((l) => chosen.has(l.id))) {
      findings.push({
        level: "error",
        check: "components",
        message: `Another component library is installed (${components.map((l) => l.name).join(", ")}); the AGENTS.md rule only allows the chosen one.`,
        fix: `Remove it, or switch explicitly with ${cliCommand(`add ${components[0]!.id} --force`)}`,
      });
    }
    const animation = installed.animation.filter((l) => !chosen.has(l.id));
    if (animation.length) {
      findings.push({
        level: "warning",
        check: "animation",
        message: `Animation libraries not chosen in the kit: ${animation.map((l) => l.name).join(", ")}.`,
        fix: `If you use it on purpose, register it with ${cliCommand(`add ${animation[0]!.id}`)}`,
      });
    }
  }

  // Organization policy (kits from "acme/…"): required and forbidden libraries.
  if (online && lock?.kit?.includes("/")) findings.push(...(await checkPolicy(dir, lock)));

  // Env vars: every key of .env.example should be set somewhere.
  const example = readEnvFile(join(dir, ".env.example"));
  if (example) {
    const actual = { ...readEnvFile(join(dir, ".env")), ...readEnvFile(join(dir, ".env.local")) };
    const missing = Object.keys(example).filter((k) => !(k in actual) && !process.env[k]);
    const empty = Object.keys(example).filter((k) => k in actual && !actual[k] && !process.env[k]);
    if (missing.length) {
      findings.push({ level: "warning", check: "env", message: `Undefined variables: ${missing.join(", ")}.`, fix: "cp .env.example .env and fill them in" });
    }
    if (empty.length) findings.push({ level: "warning", check: "env", message: `Empty variables: ${empty.join(", ")}.` });
  }

  if (lock) {
    // Skills for every agent.
    for (const ref of [...lock.skills, ...lock.addedSkills]) {
      const { source, skill } = parseSkillRef(ref);
      const without = lock.agents.filter((a) => !existsSync(join(dir, skillDir(a), skill)));
      if (without.length) {
        findings.push({
          level: "error",
          check: "skills",
          message: `The ${skill} skill isn't installed for ${without.join(", ")}.`,
          fix: `npx skills@latest add ${source} --skill ${skill} --agent ${without.join(" ")} --yes`,
        });
      }
    }

    // Managed files that disappeared.
    const gone = Object.keys(lock.managedFiles).filter((f) => !existsSync(join(dir, f)));
    if (gone.length) {
      findings.push({
        level: "warning",
        check: "files",
        message: `Kit files that no longer exist: ${gone.join(", ")}.`,
        fix: "If you deleted them on purpose, ignore this; `update` won't restore them.",
      });
    }

    // Newer kit version.
    if (online && lock.kit && lock.version) {
      try {
        const { kit } = await loadKit(lock.kit);
        if (kit.version !== lock.version) {
          findings.push({ level: "info", check: "version", message: `A new version of ${lock.kit} is out: ${lock.version} → ${kit.version}.`, fix: cliCommand("update") });
        }
      } catch {
        findings.push({ level: "info", check: "version", message: `Couldn't check the latest version of ${lock.kit}.` });
      }
    }
  }
  return findings;
}

function readEnvFile(path: string): Record<string, string> | null {
  if (!existsSync(path)) return null;
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m) out[m[1]!] = m[2]!.replace(/^["']|["']$/g, "").trim();
  }
  return out;
}

/** Libraries the project uses: chosen in kits.lock plus detected from package.json. */
async function usedLibraries(dir: string, lock: KitsLock): Promise<Set<string>> {
  const used = new Set([...Object.values(lock.options).flat(), ...lock.added.map((a) => a.id)]);
  if (existsSync(join(dir, "package.json"))) {
    const deps = readDeps(dir);
    const framework = detectFramework(deps);
    for (const libs of Object.values(installedLibraries(dir, await loadCatalog(), framework?.frameworks ?? [], deps))) for (const l of libs) used.add(l.id);
  }
  used.delete("none");
  return used;
}

export async function checkPolicy(dir: string, lock: KitsLock): Promise<Finding[]> {
  const org = lock.kit!.split("/")[0]!;
  const res = await api<{ policy: { required: string[]; forbidden: string[] } }>(`/api/v1/orgs/${org}/policy`, { timeoutMs: 5000 });
  if (res.status === 0) return [{ level: "info", check: "policy", message: `Couldn't check ${org}'s policy.` }];
  if (res.status === 404) return []; // Not an organization (a user's kit) or not a member.
  if (res.status === 401) {
    return [{ level: "warning", check: "policy", message: `The kit belongs to ${org}: log in to check its policy.`, fix: `${cliCommand("login")} (in CI: KITS_TOKEN)` }];
  }
  if (!res.ok) return [{ level: "info", check: "policy", message: `Couldn't check ${org}'s policy (${res.status}).` }];
  const { policy } = res.data;
  const used = await usedLibraries(dir, lock);
  const findings: Finding[] = [];
  const missing = policy.required.filter((id) => !used.has(id));
  if (missing.length) {
    findings.push({ level: "error", check: "policy", message: `${org} exige: ${missing.join(", ")}.`, fix: cliCommand(`add ${missing[0]}`) });
  }
  const banned = policy.forbidden.filter((id) => used.has(id));
  if (banned.length) {
    findings.push({ level: "error", check: "policy", message: `${org} forbids: ${banned.join(", ")}.`, fix: "Remove it from the project or ask an admin to change the policy" });
  }
  return findings;
}
