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

export async function checkSkills(refs: Iterable<string>, onSource?: (source: string, ok: boolean) => void): Promise<{ missing: string[] }> {
  const bySource = new Map<string, string[]>();
  for (const ref of refs) {
    const { source, skill } = parseSkillRef(ref);
    bySource.set(source, [...new Set([...(bySource.get(source) ?? []), skill])]);
  }

  const cwd = mkdtempSync(join(tmpdir(), "kits-check-"));
  const missing: string[] = [];
  for (const [source, skills] of bySource) {
    // Most sources expose ordinary SKILL.md files. Verify their declared names without
    // cloning a whole framework repository; use the installer for unusual layouts/failures.
    const verified = await githubSkills(source, skills);
    const remaining = skills.filter((s) => !verified.has(s));
    if (!remaining.length) {
      onSource?.(source, true);
      continue;
    }
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
    const absent = remaining.filter((s) => !available.has(s) && !installs(source, s));
    missing.push(...absent.map((s) => `${source}@${s}`));
    onSource?.(source, absent.length === 0);
  }
  return { missing };
}

/** Only a YAML frontmatter name counts; a heading or a name in the body is not a skill. */
export function declaredSkillName(content: string): string | undefined {
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  const match = frontmatter?.match(/^name:\s*(?:"([\w.:-]+)"|'([\w.:-]+)'|([\w.:-]+))\s*$/m);
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

async function githubSkills(source: string, skills: string[]): Promise<Set<string>> {
  const verified = new Set<string>();
  if (!/^[\w.-]+\/[\w.-]+$/.test(source)) return verified;
  try {
    // This conventional layout avoids an API tree request for large framework repos.
    await verifyPaths(source, skills.map((s) => `skills/${s}/SKILL.md`), skills, verified);
    if (verified.size === skills.length) return verified;
    const headers: Record<string, string> = { "User-Agent": "create-first-commit", Accept: "application/vnd.github+json" };
    const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`https://api.github.com/repos/${source}/git/trees/HEAD?recursive=1`, { headers, signal: AbortSignal.timeout(60_000) });
    if (!response.ok) return verified;
    const data = await response.json() as { tree?: { path: string; type: string; size?: number }[] };
    const paths = data.tree?.filter((f) => f.type === "blob" && f.path.endsWith("/SKILL.md") && (f.size ?? 0) <= 128_000) ?? [];
    const candidates = paths.filter((f) => skills.some((s) => !verified.has(s) && f.path.endsWith(`/${s}/SKILL.md`)));
    await verifyPaths(source, candidates.map((f) => f.path), skills, verified);
  } catch { /* Network/rate limits fall back to the existing installer check. */ }
  return verified;
}

async function verifyPaths(source: string, paths: string[], skills: string[], verified: Set<string>): Promise<void> {
  for (let i = 0; i < paths.length; i += 4) {
    await Promise.all(paths.slice(i, i + 4).map(async (path) => {
      try {
        const encoded = path.split("/").map(encodeURIComponent).join("/");
        const file = await fetch(`https://raw.githubusercontent.com/${source}/HEAD/${encoded}`, { signal: AbortSignal.timeout(15_000) });
        if (!file.ok || Number(file.headers.get("content-length") ?? 0) > 128_000) return;
        const name = declaredSkillName(await file.text());
        if (name && skills.includes(name)) verified.add(name);
      } catch { /* The tree/installer remain the fallback. */ }
    }));
  }
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
