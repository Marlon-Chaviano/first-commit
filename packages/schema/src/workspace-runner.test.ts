import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, it } from "vitest";
import { loadKitFrom } from "./load";
import { registrySource } from "./node/registry";
import { buildPlan } from "./plan";
import { selectionsFrom } from "./selections";

const source = registrySource(fileURLToPath(new URL("../../../registry", import.meta.url)));
const kit = await loadKitFrom(await source.read("monorepo"), source);
const exec = promisify(execFile);

it("runs a service from any directory, loads its environment, and propagates verification failures", async () => {
  const dir = await mkdtemp(join(tmpdir(), "workspace-runner-"));
  try {
    const sel = selectionsFrom(kit, { options: { web: ["none"], api: ["fastapi"] } }).selections;
    const plan = buildPlan({ kit, kitDir: "", sel, parentDir: dir, name: "demo", git: false });
    const runner = plan.find((step) => step.kind === "write" && step.path.endsWith("scripts/workspace.mjs"));
    if (runner?.kind !== "write") throw new Error("Missing runner");
    const root = join(dir, "demo");
    await mkdir(join(root, "scripts"), { recursive: true });
    await mkdir(join(root, "apps/api"), { recursive: true });
    await writeFile(runner.path, runner.merge(undefined)!);
    await writeFile(join(root, "workspace.json"), JSON.stringify({ api: { cwd: "apps/api", verify: "node verify.cjs", env: { PORT: "8000" } } }));
    await writeFile(join(root, "apps/api/.env"), "WORKSPACE_RUNNER_TEST=base\n");
    await writeFile(join(root, "apps/api/.env.local"), "WORKSPACE_RUNNER_TEST=local\n");
    await writeFile(join(root, "apps/api/verify.cjs"), "require('node:assert/strict').equal(process.env.WORKSPACE_RUNNER_TEST, 'local'); console.log('verified in ' + process.cwd());\n");
    const result = await exec(process.execPath, [runner.path, "verify", "api"], { cwd: dir });
    expect(result.stdout).toContain(join(root, "apps/api"));
    await writeFile(join(root, "apps/api/verify.cjs"), "process.exit(7)\n");
    await expect(exec(process.execPath, [runner.path, "verify", "api"], { cwd: dir })).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining("api failed: 7") });
  } finally { await rm(dir, { force: true, recursive: true }); }
});

it("forwards web server ports with the selected manager and carries the API URL into Docker builds", () => {
  for (const pm of ["npm", "pnpm", "bun"] as const) {
    const sel = selectionsFrom(kit, { pm, options: { web: ["react"], deployment: ["compose"] } }, { requirements: "throw" }).selections;
    const plan = buildPlan({ kit, kitDir: "", sel, parentDir: "/tmp", name: "demo", git: false });
    const file = (path: string) => {
      const step = plan.find((s) => s.kind === "write" && s.path === `/tmp/demo/${path}`);
      if (step?.kind !== "write") throw new Error(`Missing ${path}`);
      return step.merge(undefined)!;
    };
    const commands = JSON.parse(file("workspace.json"));
    expect(commands.web.dev.trim()).toBe(pm === "npm" ? "npm run dev -- --port 3000" : `${pm} run dev  --port 3000`);
    const compose = JSON.parse(file("compose.yaml"));
    expect(compose.services.web.build.args.VITE_API_URL).toBe("${VITE_API_URL:-http://localhost:8000}");
    expect(file("apps/web/Dockerfile")).toContain("ARG VITE_API_URL\nENV VITE_API_URL=$VITE_API_URL");
    expect(file("apps/api/Dockerfile")).toContain("${PORT:-8000}");
  }
});
