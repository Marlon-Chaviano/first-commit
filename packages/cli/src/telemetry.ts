import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { isAbsolute, join } from "node:path";

import { BRAND, splitKitRef, type InstallEvent, type Selections } from "@kits/schema";

/** Where the CLI reports installs. Override with KITS_API_URL (e.g. http://localhost:3200). */
const DEFAULT_API_URL = BRAND.siteUrl;

export function telemetryEnabled(): boolean {
  return !(process.env.DO_NOT_TRACK === "1" || process.env.KITS_TELEMETRY === "0" || process.env.CI);
}

/**
 * Reports an anonymous install (or update / add) so kits can be ranked. Fire-and-forget: it
 * never throws and gives up after 1.5s. Local kits (paths) are never reported.
 */
export async function reportEvent(
  type: InstallEvent["type"],
  kitRef: string,
  kitVersion: string | undefined,
  sel: Selections,
  skills: string[],
  version: string,
): Promise<void> {
  if (!telemetryEnabled() || kitRef.startsWith(".") || isAbsolute(kitRef)) return;
  try {
    const event: InstallEvent = {
      type,
      kit: splitKitRef(kitRef).base,
      ...(kitVersion ? { kitVersion } : {}),
      options: sel.options,
      skills,
      agents: sel.agents,
      pm: sel.pm,
      cliVersion: version,
      os: platform(),
      anonId: await anonymousId(),
    };
    await fetch(`${process.env.KITS_API_URL ?? DEFAULT_API_URL}/api/v1/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    // Offline, blocked or slow: telemetry must never affect the install.
  }
}

/** Random per-machine id, so installs can be counted as unique without knowing who you are. */
async function anonymousId(): Promise<string> {
  const dir = join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "kits");
  const file = join(dir, "anonymous-id");
  if (existsSync(file)) {
    const id = (await readFile(file, "utf8")).trim();
    if (/^[0-9a-f-]{36}$/.test(id)) return id;
  }
  const id = randomUUID();
  await mkdir(dir, { recursive: true });
  await writeFile(file, id + "\n");
  return id;
}

export const reportInstall = (kitRef: string, kitVersion: string, sel: Selections, skills: string[], version: string) =>
  reportEvent("install", kitRef, kitVersion, sel, skills, version);
