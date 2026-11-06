import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseSkillRef } from "@kits/schema";

/**
 * Checks that every "owner/repo@skill" still exists, asking the skills CLI.
 * Search indexes can list skills a repo has removed, and some repos hide skills
 * from `--list` that still install by name, so a missing one gets a real
 * install attempt in a temp folder before being reported.
 */
/** Per repository: a huge or unreachable repo is reported as missing instead of blocking the check. */
const TIMEOUT_MS = 180_000;

export function checkSkills(refs: Iterable<string>, onSource?: (source: string, ok: boolean) => void): { missing: string[] } {
  const bySource = new Map<string, string[]>();
  for (const ref of refs) {
    const { source, skill } = parseSkillRef(ref);
    bySource.set(source, [...new Set([...(bySource.get(source) ?? []), skill])]);
  }

  const cwd = mkdtempSync(join(tmpdir(), "kits-check-"));
  const missing: string[] = [];
  for (const [source, skills] of bySource) {
    let output = "";
    try {
      output = execFileSync("npx", ["-y", "skills@latest", "add", source, "--list"], {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: TIMEOUT_MS,
      }).replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");
    } catch {
      // Network hiccup or rate limit: fall through to trying a real install.
    }
    const available = new Set([...output.matchAll(/^│ {4}(\S+)\s*$/gm)].map((m) => m[1]));
    const absent = skills.filter((s) => !available.has(s) && !installs(source, s));
    missing.push(...absent.map((s) => `${source}@${s}`));
    onSource?.(source, absent.length === 0);
  }
  return { missing };
}

function installs(source: string, skill: string): boolean {
  const dir = mkdtempSync(join(tmpdir(), "kits-try-"));
  try {
    execFileSync("npx", ["-y", "skills@latest", "add", source, "--skill", skill, "--agent", "claude-code", "--yes"], {
      cwd: dir,
      stdio: "ignore",
      timeout: TIMEOUT_MS,
    });
    return existsSync(join(dir, ".claude", "skills", skill));
  } catch {
    return false;
  }
}
