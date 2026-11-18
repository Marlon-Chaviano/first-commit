import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { kitsLockSchema } from "@kits/schema";
import { afterEach, expect, it, vi } from "vitest";

import { add } from "./add";
import { parseArgs } from "./args";
import { writeLock } from "./lockfile";
import { loadKit } from "./registry";

const registry = fileURLToPath(new URL("../../../registry", import.meta.url));
afterEach(() => vi.unstubAllEnvs());

it.each([
  { kit: "web-next", dependencies: { next: "16" }, library: "security-pack", offered: true },
  { kit: "chrome-extension", dependencies: { wxt: "1", react: "19" }, library: "chrome-web-store", offered: true },
  { kit: "chrome-extension", dependencies: { wxt: "1", react: "19" }, library: "vercel-static", offered: false },
])("agrees with $kit about adding $library", async ({ kit, dependencies, library, offered }) => {
  vi.stubEnv("KITS_REGISTRY", registry);
  const dir = await mkdtemp(join(tmpdir(), "kits-add-"));
  try {
    const loaded = (await loadKit(kit)).kit;
    expect(loaded.options.some((option) => option.choices.some((c) => c.id === library))).toBe(offered);
    await writeFile(join(dir, "package.json"), JSON.stringify({ dependencies }));
    const dryRun = () => add(parseArgs(["add", library, "--dry-run", "--dir", dir]), () => { throw new Error("Unexpected prompt"); }, "test");
    // Check both dependency detection and the framework/platform recorded by a kit.
    for (const locked of [false, true]) {
      if (locked) await writeLock(dir, kitsLockSchema.parse({ lockVersion: 1, kit, version: loaded.version, pm: "pnpm", options: { framework: ["react"] }, updatedAt: new Date().toISOString() }));
      if (offered) await expect(dryRun()).resolves.toBeUndefined();
      else await expect(dryRun()).rejects.toThrow("has no variant");
      expect(existsSync(join(dir, "AGENTS.md"))).toBe(false);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
