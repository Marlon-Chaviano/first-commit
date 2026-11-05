import { closeSync, openSync, readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

import * as p from "@clack/prompts";
import {
  allKitSkills,
  BRAND,
  buildPlan,
  DEFAULT_VERIFY_COMMAND,
  fillTemplate,
  templateVars,
  testCombinations,
  VERIFICATION_AUDIENCE,
  type CombinationResult,
  type VerificationReport,
} from "@kits/schema";
import pc from "picocolors";

import type { ParsedArgs } from "./args";
import { execute, run, StepError } from "./exec";
import { nodePaths } from "./paths";
import { loadKit } from "./registry";
import { checkSkills } from "./skills-check";

/** Spinner in a terminal; plain lines in CI logs, where spinner frames pile up. */
function progress() {
  if (process.stdout.isTTY) return p.spinner();
  return { start: (m: string) => p.log.step(m), stop: (m: string) => p.log.success(m), error: (m: string) => p.log.error(m) };
}

/**
 * `create-first-commit test [kit]` — installs the kit with several option combinations in
 * temp folders, runs its `verify` command and writes a JSON report.
 */
export async function test(args: ParsedArgs, cliVersion: string): Promise<void> {
  const ref = args.positionals[0] ?? ".";
  const startedAt = new Date();
  p.intro(pc.bgCyan(pc.black(` ${BRAND.name} test `)));

  const loaded = await loadKit(ref);
  const { kit } = loaded;
  let combos = testCombinations(kit);
  if (args.switches.has("only-defaults")) combos = combos.slice(0, 1);
  const max = Number(args.flags.get("max")?.[0] ?? Infinity);
  combos = combos.slice(0, max);
  const pm = args.flags.get("pm")?.[0] as (typeof combos)[number]["sel"]["pm"] | undefined;
  const command = kit.verify?.command ?? DEFAULT_VERIFY_COMMAND;
  // Per command, so one hung install fails its combination instead of blocking the run forever.
  const timeoutMs = Number(args.flags.get("timeout")?.[0] ?? 20) * 60_000;
  p.log.info(`${kit.name}@${kit.version} · ${combos.length} combinaciones · verificación: ${command}`);

  // Skills are checked once (they don't affect the build) instead of installed per combination.
  let skills: VerificationReport["skills"] = { checked: 0, missing: [] };
  const refs = allKitSkills(kit);
  if (!args.switches.has("skip-skills") && refs.length) {
    const spinner = progress();
    spinner.start(`Comprobando ${refs.length} skills`);
    skills = { checked: refs.length, ...checkSkills(refs) };
    if (skills.missing.length) spinner.error(`Skills que no existen: ${skills.missing.join(", ")}`);
    else spinner.stop(`${refs.length} skills existen`);
  }

  const keep = args.switches.has("keep");
  const logDir = await mkdtemp(join(tmpdir(), "kits-test-logs-"));
  const results: CombinationResult[] = [];
  for (const [i, combo] of combos.entries()) {
    const sel = pm ? { ...combo.sel, pm } : combo.sel;
    const spinner = progress();
    spinner.start(`[${i + 1}/${combos.length}] ${combo.label}`);
    const started = Date.now();
    const parentDir = await mkdtemp(join(tmpdir(), "kits-test-"));
    const projectDir = join(parentDir, "app");
    const logPath = join(logDir, `${i + 1}.log`);
    const fd = openSync(logPath, "a");
    let failedStep: string | undefined;
    let error: string | undefined;
    try {
      const steps = buildPlan({ kit, kitDir: loaded.dir, sel, parentDir, name: "app", git: false, paths: nodePaths });
      const failed = await execute(steps, projectDir, { logFd: fd, timeoutMs });
      // Strict: a setup step that only warns during `init` still fails verification.
      if (failed.length) failedStep = failed.map((s) => s.title).join(", ");
      else {
        failedStep = "Verificación";
        await run(fillTemplate(command, templateVars(sel, "app")), projectDir, fd, timeoutMs);
        failedStep = undefined;
      }
    } catch (e) {
      failedStep ??= e instanceof StepError ? e.step.title : "Plan";
      error = (e as Error).message;
    } finally {
      closeSync(fd);
      // Each combination is a full project with node_modules: delete it unless asked to keep it.
      if (!keep) await rm(parentDir, { recursive: true, force: true }).catch(() => {});
    }
    const ok = failedStep === undefined;
    // Last lines of output plus the reason (exit code, timeout…), within the report's size limit.
    if (!ok) error = [tail(logPath), error].filter(Boolean).join("\n").slice(-4000);
    results.push({ label: combo.label, options: sel.options, pm: sel.pm, ok, durationMs: Date.now() - started, failedStep, error });
    const secs = Math.round((Date.now() - started) / 1000);
    if (ok) spinner.stop(`${pc.green("✓")} ${combo.label} ${pc.dim(`${secs}s`)}`);
    else spinner.error(`${combo.label} — falló en "${failedStep}" ${pc.dim(`(log: ${logPath})`)}`);
  }

  const report: VerificationReport = {
    kit: publicRef(ref, kit.name),
    version: kit.version,
    cliVersion,
    platform: process.platform,
    node: process.version,
    startedAt: startedAt.toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    skills,
    combinations: results,
    ok: results.every((r) => r.ok) && skills.missing.length === 0,
  };
  const reportPath = resolve(args.flags.get("report")?.[0] ?? "kits-test-report.json");
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
  p.log.info(`Informe: ${relative(process.cwd(), reportPath)} · logs: ${logDir}`);

  if (args.switches.has("upload")) await upload(report);

  if (report.ok) p.outro(pc.green(`${kit.name}@${kit.version} verificado: ${results.length} combinaciones correctas.`));
  else {
    p.outro(pc.red(`${results.filter((r) => !r.ok).length} de ${results.length} combinaciones fallaron.`));
    process.exitCode = 1;
  }
}

/** Last lines of a combination's log, so the report explains the failure. */
function tail(logPath: string): string {
  try {
    const lines = readFileSync(logPath, "utf8").replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "").trimEnd().split("\n");
    return lines.slice(-40).join("\n").slice(-3500);
  } catch {
    return "";
  }
}

/**
 * How others install this kit. In GitHub Actions: the official registry name
 * for registry/kits/<name>, otherwise "owner/repo[/path]".
 */
function publicRef(ref: string, name: string): string {
  const repo = process.env.GITHUB_REPOSITORY;
  const workspace = process.env.GITHUB_WORKSPACE;
  if (!repo || !workspace || !(ref.startsWith(".") || ref.startsWith("/"))) return ref;
  const path = relative(workspace, resolve(ref));
  if (repo === BRAND.repo && path === `registry/kits/${name}`) return name;
  return path ? `${repo}/${path}` : repo;
}

/**
 * Sends the report signed with the job's GitHub OIDC token, so the server
 * knows which repository and commit produced it and nobody can forge one.
 * Needs `permissions: id-token: write` in the workflow.
 */
async function upload(report: VerificationReport): Promise<void> {
  const url = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const token = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!url || !token) {
    throw new Error("--upload solo funciona en GitHub Actions con `permissions: id-token: write`.");
  }
  const oidc = await fetch(`${url}&audience=${encodeURIComponent(VERIFICATION_AUDIENCE)}`, {
    headers: { authorization: `bearer ${token}` },
  });
  if (!oidc.ok) throw new Error(`No se pudo obtener el token OIDC de GitHub (${oidc.status})`);
  const { value } = (await oidc.json()) as { value: string };

  const api = process.env.KITS_API_URL ?? BRAND.siteUrl;
  const res = await fetch(`${api}/api/v1/verifications`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${value}` },
    body: JSON.stringify(report),
  });
  if (!res.ok) throw new Error(`La API rechazó el informe (${res.status}): ${await res.text()}`);
  p.log.success(`Informe enviado a ${api}`);
}
