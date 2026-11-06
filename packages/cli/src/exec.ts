import { spawn, type StdioOptions } from "node:child_process";
import { closeSync, existsSync, openSync, readFileSync, writeSync } from "node:fs";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";

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
  /** --verbose: every command's output in the terminal, as it happens (instead of the progress bar). */
  verbose?: boolean;
}

/**
 * Runs every step; returns the optional steps that failed. In a terminal it draws one progress bar
 * for the whole plan and sends command output to a log file (shown if something fails); in CI,
 * with --verbose or with a log fd, it prints each step and streams the output as before.
 */
export async function execute(steps: Step[], root: string, opts: ExecuteOptions = {}): Promise<Step[]> {
  if (opts.logFd === undefined && !opts.verbose && process.stdout.isTTY && !p.isCI()) return executeWithProgress(steps, root, opts);
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
          if (!quiet) p.log.warn(`Failed, continuing with the rest: ${(error as Error).message}`);
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
          if (!quiet) p.log.warn(`Couldn't apply: ${(error as Error).message}`);
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

/** Writes a file step; shared by both renderers. */
async function writeStep(step: Extract<Step, { kind: "write" }>): Promise<void> {
  const existing = existsSync(step.path) ? await readFile(step.path, "utf8") : undefined;
  const next = step.merge(existing);
  if (next !== existing) {
    await mkdir(dirname(step.path), { recursive: true });
    await writeFile(step.path, next);
  }
}

/** The last lines of the log, for the error: usually enough to see what went wrong without opening it. */
function tail(path: string, lines = 20): string {
  try {
    return readFileSync(path, "utf8").replace(/\x1b\[[0-9;]*[A-Za-z]/g, "").trimEnd().split("\n").slice(-lines).join("\n");
  } catch {
    return "";
  }
}

/** The bar's cells, and the columns around the message: spinner and gaps, the bar, clack's timer ("[1m 05s]"). */
const BAR_SIZE = 20;
const BAR_CHROME = 3 + BAR_SIZE + 1 + 10;
const CELL = p.unicode ? "━" : "=";

/** Filled cells in the terminal's own color, the rest dimmed: no accent color, like the site. */
const drawBar = (done: number, total: number) => {
  const filled = Math.round((done / Math.max(1, total)) * BAR_SIZE);
  return `${CELL.repeat(filled)}${pc.dim(CELL.repeat(BAR_SIZE - filled))}`;
};

/** A tool's output line as a short hint: no spinners, bullets or box drawing, single spaces. */
export function cleanHint(line: string): string {
  return line
    .replace(/[\u2500-\u25ff\u2800-\u28ff\u2190-\u21ff\u2700-\u27bf●○◆◇◐◑◒◓✔✓✖✗│┃├└┌┐┘─]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function executeWithProgress(steps: Step[], root: string, opts: ExecuteOptions): Promise<Step[]> {
  const failed: Step[] = [];
  const logPath = join(tmpdir(), `${"first-commit"}-${new Date().toISOString().replace(/[:.]/g, "-")}.log`);
  const fd = openSync(logPath, "a");
  // clack's spinner with our own bar: its built-in progress() is magenta, and dots would make the line jump.
  const bar = p.spinner({ indicator: "timer", styleFrame: (frame) => frame });
  let done = 0;
  // One line, always: the bar, the counter, the step and, if there's room, the latest output.
  const label = (i: number, hint = "") => {
    const counter = `${Math.min(i + 1, steps.length)}/${steps.length}`;
    const title = steps[i]?.title ?? "Done";
    const room = (process.stdout.columns || 80) - BAR_CHROME - counter.length - 1;
    const shownTitle = title.length > room ? `${title.slice(0, Math.max(0, room - 1))}…` : title;
    const left = room - shownTitle.length - 2;
    const shownHint = hint && left > 12 ? (hint.length > left ? `${hint.slice(0, left - 1)}…` : hint) : "";
    return `${drawBar(done, steps.length)} ${pc.dim(counter)} ${shownTitle}${shownHint ? pc.dim(`  ${shownHint}`) : ""}`;
  };
  bar.start(label(0));
  try {
    for (const [i, step] of steps.entries()) {
      bar.message(label(i));
      try {
        if (step.kind === "run") {
          writeSync(fd, `\n$ ${step.command}\n`);
          // The latest line of output as a hint, so a long install visibly makes progress.
          let last = 0;
          await run(step.command, step.cwd, fd, opts.timeoutMs, (line) => {
            const hint = cleanHint(line);
            if (!hint || Date.now() - last < 150) return;
            last = Date.now();
            bar.message(label(i, hint));
          });
        } else if (step.kind === "copy") await cp(step.from, step.to, { recursive: true, force: true });
        else if (step.kind === "write") await writeStep(step);
        else await commit(step.cwd);
      } catch (error) {
        if (!("optional" in step && step.optional)) {
          bar.error(`${step.title} failed`);
          const output = tail(logPath);
          if (output) p.log.message(pc.dim(output));
          p.log.info(`Full log: ${pc.underline(logPath)}`);
          throw new StepError(step, error as Error);
        }
        writeSync(fd, `\n! optional step failed: ${(error as Error).message}\n`);
        failed.push(step);
      }
      done++;
      bar.message(label(i + 1));
    }
    // The spinner's timer adds the total time: "◇  5 steps [30s]".
    bar.stop(`${steps.length} steps${failed.length ? pc.yellow(` · ${failed.length} skipped`) : ""}`);
    // The log matters when something was skipped; otherwise it's just there if wanted.
    if (failed.length) p.log.info(`Log: ${pc.underline(logPath)}`);
    return failed;
  } finally {
    closeSync(fd);
  }
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

/**
 * `output`: a log file descriptor, "ignore", or the terminal (default). With `onLine` (and a log fd)
 * the output is piped: written to the log and each line passed on, for progress hints.
 */
export function run(command: string, cwd: string, output?: number | "ignore", timeoutMs?: number, onLine?: (line: string) => void): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const piped = typeof output === "number" && onLine !== undefined;
    const stdio: StdioOptions = output === undefined ? "inherit" : output === "ignore" ? "ignore" : piped ? ["ignore", "pipe", "pipe"] : ["ignore", output, output];
    // detached: own process group, so a timeout kills the whole tree (npm, pnpm, their children).
    // No colors in the log. (Not CI=1: it changes what tools do, e.g. pnpm's frozen lockfile.)
    const env = piped ? { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" } : process.env;
    const child = spawn(command, { cwd, shell: true, stdio, env, detached: timeoutMs !== undefined });
    if (piped) {
      const forward = (chunk: Buffer) => {
        writeSync(output, chunk);
        const line = chunk.toString("utf8").replace(/\x1b\[[0-9;]*[A-Za-z]/g, "").split(/\r?\n|\r/).map((l) => l.trim()).filter(Boolean).at(-1);
        if (line) onLine(line);
      };
      child.stdout?.on("data", forward);
      child.stderr?.on("data", forward);
    }
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
      if (timedOut) reject(new Error(`Timed out (${Math.round(timeoutMs! / 60000)} min): ${command}`));
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
    p.log.warn("Couldn't make the initial commit (is git configured?). You can do it by hand.");
  }
}
