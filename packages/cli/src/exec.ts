import { spawn, type StdioOptions } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative } from "node:path";

import * as p from "@clack/prompts";
import pc from "picocolors";

import type { Step } from "@kits/schema";

export function describe(step: Step, root: string): string {
  switch (step.kind) {
    case "run":
      return `${step.title}\n    ${pc.dim("$")} ${pc.cyan(step.command)}`;
    case "copy":
      return `${step.title} → ${pc.dim(relative(root, step.to) || ".")}`;
    case "write":
      return `${step.title} ${pc.dim(relative(root, step.path))}`;
    case "git":
      return step.title;
  }
}

export interface ExecuteOptions {
  /** File descriptor that receives command output instead of the terminal (create-first-commit test). */
  logFd?: number;
  /** Kill a command that runs longer than this (create-first-commit test: a hung install must not block CI forever). */
  timeoutMs?: number;
}

/** Runs every step; returns the optional steps that failed. */
export async function execute(steps: Step[], root: string, opts: ExecuteOptions = {}): Promise<Step[]> {
  const quiet = opts.logFd !== undefined;
  const failed: Step[] = [];
  for (const [i, step] of steps.entries()) {
    if (!quiet) p.log.step(`${pc.dim(`[${i + 1}/${steps.length}]`)} ${describe(step, root)}`);
    switch (step.kind) {
      case "run":
        try {
          await run(step.command, step.cwd, opts.logFd, opts.timeoutMs);
        } catch (error) {
          if (!step.optional) throw new StepError(step, error as Error);
          if (!quiet) p.log.warn(`Falló, sigo con el resto: ${(error as Error).message}`);
          failed.push(step);
        }
        break;
      case "copy":
        await cp(step.from, step.to, { recursive: true, force: true });
        break;
      case "write": {
        try {
          const existing = existsSync(step.path) ? await readFile(step.path, "utf8") : undefined;
          const next = step.merge(existing);
          if (next !== existing) {
            await mkdir(dirname(step.path), { recursive: true });
            await writeFile(step.path, next);
          }
        } catch (error) {
          if (!step.optional) throw new StepError(step, error as Error);
          if (!quiet) p.log.warn(`No se pudo aplicar: ${(error as Error).message}`);
          failed.push(step);
        }
        break;
      }
      case "git":
        await commit(step.cwd);
        break;
    }
  }
  return failed;
}

/** A step that failed, so callers can report which one. */
export class StepError extends Error {
  constructor(
    readonly step: Step,
    cause: Error,
  ) {
    super(cause.message, { cause });
  }
}

/** `output`: a log file descriptor, "ignore", or the terminal (default). */
export function run(command: string, cwd: string, output?: number | "ignore", timeoutMs?: number): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const stdio: StdioOptions = output === undefined ? "inherit" : output === "ignore" ? "ignore" : ["ignore", output, output];
    // detached: own process group, so a timeout kills the whole tree (npm, pnpm, their children).
    const child = spawn(command, { cwd, shell: true, stdio, env: process.env, detached: timeoutMs !== undefined });
    let timedOut = false;
    const timer =
      timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            timedOut = true;
            try {
              process.kill(-child.pid!, "SIGKILL");
            } catch {
              child.kill("SIGKILL");
            }
          }, timeoutMs);
    child.on("error", reject);
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (timedOut) reject(new Error(`Tiempo agotado (${Math.round(timeoutMs! / 60000)} min): ${command}`));
      else if (code === 0) resolvePromise();
      else reject(new Error(`Command failed (exit ${code}): ${command}`));
    });
  });
}

/** Scaffolders like create-expo-app already init git; just commit the kit on top. Never fatal. */
async function commit(cwd: string): Promise<void> {
  try {
    if (!existsSync(`${cwd}/.git`)) await run("git init -q", cwd, "ignore");
    await run("git add -A", cwd, "ignore");
    await run('git commit -q -m "chore: set up workspace with kits"', cwd, "ignore");
  } catch {
    p.log.warn("No se pudo hacer el commit inicial (¿git configurado?). Puedes hacerlo a mano.");
  }
}
