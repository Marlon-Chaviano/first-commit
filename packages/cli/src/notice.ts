import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";

import { cliCommand } from "@kits/schema";
import pc from "picocolors";

import { readLock } from "./lockfile";
import { api } from "./api";
import { loadIndex } from "./registry";

const DAY = 24 * 60 * 60 * 1000;
const stateFile = () => join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "kits", "update-check.json");

/**
 * Once a day per kit, inside a project with kits.lock: tells the user a newer
 * version of their kit exists. Cheap lookups only (registry index, API or local
 * kit.json) and never fails the command.
 */
export async function updateNotice(projectDir: string): Promise<void> {
  try {
    if (process.env.CI || process.env.KITS_NO_UPDATE_NOTICE) return;
    const lock = await readLock(projectDir);
    if (!lock?.kit || !lock.version) return;
    const state = existsSync(stateFile()) ? (JSON.parse(await readFile(stateFile(), "utf8")) as Record<string, number>) : {};
    if (Date.now() - (state[lock.kit] ?? 0) < DAY) return;
    state[lock.kit] = Date.now();
    await mkdir(join(stateFile(), ".."), { recursive: true });
    await writeFile(stateFile(), JSON.stringify(state));

    const latest = await latestVersion(lock.kit);
    if (latest && latest !== lock.version) {
      console.log(`\n${pc.yellow("●")} A new version of ${pc.bold(lock.kit)} is out: ${lock.version} → ${pc.bold(latest)}. Update with ${pc.cyan(cliCommand("update"))}\n`);
    }
  } catch {
    // A notice must never break the command.
  }
}

async function latestVersion(kit: string): Promise<string | null> {
  if (isAbsolute(kit)) {
    const path = join(kit, "kit.json");
    return existsSync(path) ? ((JSON.parse(await readFile(path, "utf8")) as { version?: string }).version ?? null) : null;
  }
  if (!kit.includes("/")) return (await loadIndex()).find((e) => e.name === kit)?.version ?? null;
  const res = await api<{ version?: string }>(`/api/v1/kits/${kit}`, { auth: "none", timeoutMs: 2000 });
  return res.ok ? (res.data?.version ?? null) : null;
}
