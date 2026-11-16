import { mkdtemp, mkdir, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { kitsLockSchema } from "@kits/schema";
import { readLock, writeLock } from "./lockfile";

it("stores service changes in the root lock without creating nested locks", async () => {
  const dir = await mkdtemp(join(tmpdir(), "workspace-lock-"));
  try {
    const child = kitsLockSchema.parse({ lockVersion: 1, kit: "api-fastapi", version: "1.0.0", pm: "pip", embedded: true, workspaceService: true, updatedAt: new Date().toISOString() });
    const root = kitsLockSchema.parse({ ...child, lockVersion: 2, kit: "monorepo", pm: "pnpm", services: { api: { ...child, path: "apps/api" } } });
    await mkdir(join(dir, "apps/api"), { recursive: true });
    await writeLock(dir, root);
    expect((await readLock(join(dir, "apps/api")))?.pm).toBe("pip");
    await writeLock(join(dir, "apps/api"), { ...child, dependencies: ["sqlmodel"] });
    expect((await readLock(dir))?.services?.api?.dependencies).toEqual(["sqlmodel"]);
    expect((await readLock(join(dir, "apps/api")))?.embedded).toBe(true);
    expect((await readLock(join(dir, "apps/api")))?.workspaceService).toBe(true);
    await expect(readFile(join(dir, "apps/api/kits.lock"))).rejects.toThrow();
    expect(kitsLockSchema.safeParse({ ...root, services: { api: { ...child, path: "../outside" } } }).success).toBe(false);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
