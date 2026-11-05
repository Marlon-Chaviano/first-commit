import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { BRAND, cliCommand, parseSkillRef, type KitsLock } from "@kits/schema";
import pc from "picocolors";

import { getToken } from "./account";
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
    console.log(`\n${pc.bold("doctor")} ${pc.dim(lock?.kit ? `${lock.kit}@${lock.version}` : "proyecto sin kits.lock")}\n`);
    if (!findings.length) console.log(`${pc.green("✓")} Todo en orden.`);
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
      message: "Este proyecto no tiene kits.lock: solo se revisan las variables de entorno.",
      fix: cliCommand("add <biblioteca>") + " crea uno",
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
        check: "componentes",
        message: `Hay otra biblioteca de componentes instalada (${components.map((l) => l.name).join(", ")}); la regla de AGENTS.md solo permite la elegida.`,
        fix: `Quítala, o cámbiala de forma explícita con ${cliCommand(`add ${components[0]!.id} --force`)}`,
      });
    }
    const animation = installed.animation.filter((l) => !chosen.has(l.id));
    if (animation.length) {
      findings.push({
        level: "warning",
        check: "animaciones",
        message: `Bibliotecas de animación no elegidas en el kit: ${animation.map((l) => l.name).join(", ")}.`,
        fix: `Si la usas a propósito, regístrala con ${cliCommand(`add ${animation[0]!.id}`)}`,
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
      findings.push({ level: "warning", check: "entorno", message: `Variables sin definir: ${missing.join(", ")}.`, fix: "cp .env.example .env y rellénalas" });
    }
    if (empty.length) findings.push({ level: "warning", check: "entorno", message: `Variables vacías: ${empty.join(", ")}.` });
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
          message: `El skill ${skill} no está instalado para ${without.join(", ")}.`,
          fix: `npx skills@latest add ${source} --skill ${skill} --agent ${without.join(" ")} --yes`,
        });
      }
    }

    // Managed files that disappeared.
    const gone = Object.keys(lock.managedFiles).filter((f) => !existsSync(join(dir, f)));
    if (gone.length) {
      findings.push({
        level: "warning",
        check: "archivos",
        message: `Archivos del kit que ya no existen: ${gone.join(", ")}.`,
        fix: "Si los borraste a propósito, ignóralo; `update` no los restaurará.",
      });
    }

    // Newer kit version.
    if (online && lock.kit && lock.version) {
      try {
        const { kit } = await loadKit(lock.kit);
        if (kit.version !== lock.version) {
          findings.push({ level: "info", check: "versión", message: `Hay una versión nueva de ${lock.kit}: ${lock.version} → ${kit.version}.`, fix: cliCommand("update") });
        }
      } catch {
        findings.push({ level: "info", check: "versión", message: `No se pudo consultar la última versión de ${lock.kit}.` });
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
  const token = await getToken();
  let res: Response;
  try {
    res = await fetch(`${process.env.KITS_API_URL ?? BRAND.siteUrl}/api/v1/orgs/${org}/policy`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    return [{ level: "info", check: "política", message: `No se pudo consultar la política de ${org}.` }];
  }
  if (res.status === 404) return []; // Not an organization (a user's kit) or not a member.
  if (res.status === 401) {
    return [{ level: "warning", check: "política", message: `El kit es de ${org}: inicia sesión para comprobar su política.`, fix: `${cliCommand("login")} (en CI: KITS_TOKEN)` }];
  }
  if (!res.ok) return [{ level: "info", check: "política", message: `No se pudo consultar la política de ${org} (${res.status}).` }];
  const { policy } = (await res.json()) as { policy: { required: string[]; forbidden: string[] } };
  const used = await usedLibraries(dir, lock);
  const findings: Finding[] = [];
  const missing = policy.required.filter((id) => !used.has(id));
  if (missing.length) {
    findings.push({ level: "error", check: "política", message: `${org} exige: ${missing.join(", ")}.`, fix: cliCommand(`add ${missing[0]}`) });
  }
  const banned = policy.forbidden.filter((id) => used.has(id));
  if (banned.length) {
    findings.push({ level: "error", check: "política", message: `${org} prohíbe: ${banned.join(", ")}.`, fix: "Quítala del proyecto o pide a un admin que cambie la política" });
  }
  return findings;
}
