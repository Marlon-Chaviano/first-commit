import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { registrySource } from "./node/registry";
import { loadKitFrom } from "./load";
import { defaultSelections, resolve, initArgs, validateSelections } from "./resolve";
import { selectionsFrom } from "./selections";
import { buildPlan } from "./plan";
import { selectedServices } from "./workspace";

const source = registrySource(fileURLToPath(new URL("../../../registry", import.meta.url)));
const kit = await loadKitFrom(await source.read("monorepo"), source, { admit: true });
describe("workspace composition", () => {
  it("reuses standalone libraries while isolating package managers and dependencies", () => {
    const sel = selectionsFrom(kit, { options: { "web.nextjs.components": ["shadcn"], "api.fastapi.database": ["sqlmodel"] } }, { requirements: "throw" }).selections;
    const services = selectedServices(kit, sel);
    expect(services.map((s) => [s.id, s.sel.pm])).toEqual([["web", "pnpm"], ["api", "pip"]]);
    const resolved = resolve(kit, sel);
    expect(resolved.dependencies).not.toContain("sqlmodel");
    expect(resolved.services!.find((s) => s.id === "api")!.resolved.dependencies).toContain("sqlmodel");
    const plan = buildPlan({ kit, kitDir: "", sel, parentDir: "/tmp", name: "demo", git: true });
    expect(plan.filter((s) => s.kind === "git")).toHaveLength(1);
    expect(plan.some((s) => s.kind === "run" && s.cwd === "/tmp/demo/apps/api" && s.command.includes("sqlmodel"))).toBe(true);
    expect(plan.some((s) => s.kind === "run" && s.cwd === "/tmp/demo" && s.command.includes("sqlmodel"))).toBe(false);
  });
  it("removes inactive options and serializes only the selected framework", () => {
    const initial = defaultSelections(kit);
    const sel = selectionsFrom(kit, { base: initial, options: { web: ["vue"], api: ["django"], docs: ["starlight"] } }).selections;
    validateSelections(kit, sel);
    expect(sel.options["web.nextjs.components"]).toEqual([]);
    expect(initArgs("monorepo", kit, sel).some((arg) => arg.startsWith("--web.nextjs."))).toBe(false);
    expect(selectedServices(kit, sel).map((s) => s.kit.name)).toEqual(["web-vue-vite", "api-django", "docs-starlight"]);
  });
  it("does not accept a service selection belonging to a different framework", () => {
    expect(() => selectionsFrom(kit, { options: { web: ["vue"], "web.nextjs.components": ["shadcn"] } }, { requirements: "throw" })).toThrow();
  });
  it("rejects overlapping directories and nested workspaces before creating a plan", async () => {
    const raw = await source.read("monorepo");
    const data = structuredClone(raw.raw) as any;
    data.workspace.services.api.path = data.workspace.services.web.path;
    await expect(loadKitFrom({ ...raw, raw: data }, source)).rejects.toThrow("overlap");
    data.workspace.services.api.path = "apps/api";
    data.workspace.services.api.variants.fastapi = "monorepo@1.0.0";
    await expect(loadKitFrom({ ...raw, raw: data }, source)).rejects.toThrow("Nested");
  });
});

it("patches framework integrations idempotently and refuses changed anchors", async () => {
  const { applyWrite } = await import("./plan");
  const patch = applyWrite({ path: "src/server.ts", mode: "replace", anchor: "port: 3000", content: "port: Number(process.env.PORT ?? 8000)" });
  const output = patch("serve({ port: 3000 });");
  expect(output).toBe("serve({ port: Number(process.env.PORT ?? 8000) });");
  expect(patch(output)).toBe(output);
  expect(() => patch("serve({ port: 1234 });")).toThrow("Couldn't find");
  expect(() => patch(undefined)).toThrow();
});

it("recommendations keep libraries inside the selected service", async () => {
  const { recommendHeuristic, resolveRecommendation } = await import("./recommend");
  const recommendation = recommendHeuristic("monorepo nextjs django mantine", [kit]);
  const resolved = resolveRecommendation(kit, recommendation, "heuristic");
  expect(resolved.selections.options.api).toEqual(["django"]);
  expect(resolved.selections.options.docs).toEqual(["none"]);
  expect(resolved.selections.options["web.nextjs.components"]).toEqual(["mantine"]);
  const conflicting = resolveRecommendation(kit, { kit: kit.name, reasons: [], options: { api: ["django"], "api.fastapi.database": ["sqlmodel"] } }, "ai");
  expect(conflicting.selections.options.api).toEqual(["django"]);
});

it("keeps native presets intact and removes them when their composition changes", async () => {
  const { preservesWorkspaceBase } = await import("./workspace");
  for (const name of ["monorepo-go", "monorepo-packages", "monorepo-t3-turbo"]) {
    const preset = await loadKitFrom(await source.read(name), source, { admit: true });
    const sel = defaultSelections(preset);
    expect(preservesWorkspaceBase(preset, sel)).toBe(true);
    const plan = buildPlan({ kit: preset, kitDir: "", sel, parentDir: "/tmp", name: "native", git: false });
    expect(plan.some((step) => step.kind === "run" && step.command.includes("Update the CLI"))).toBe(false);
    const changed = selectionsFrom(preset, { base: sel, options: { api: ["django"] } }).selections;
    if (name !== "monorepo-packages") expect(preservesWorkspaceBase(preset, changed)).toBe(false);
    if (name === "monorepo-t3-turbo") {
      expect(sel.options["web.nextjs.components"]).toEqual(["none"]);
      expect(plan.some((step) => step.kind === "run" && step.title.startsWith("web:") && step.command.includes("shadcn"))).toBe(false);
      expect(() => selectionsFrom(preset, { options: { web: ["none"], api: ["none"], docs: ["none"], mobile: ["none"] } })).toThrow("Select at least one service");
      expect(resolve(preset, sel).services?.filter((s) => s.embedded).length).toBeGreaterThan(0);
    }
  }
});

it("generates real root CI for package-only workspaces and respects deployment mode", async () => {
  const native = await loadKitFrom(await source.read("monorepo-packages"), source);
  const plan = buildPlan({ kit: native, kitDir: "", sel: defaultSelections(native), parentDir: "/tmp", name: "packages", git: false });
  const workflow = plan.find((step) => step.kind === "write" && step.path.endsWith(".github/workflows/workspace.yml"));
  expect(workflow?.kind).toBe("write");
  if (workflow?.kind !== "write") return;
  const data = JSON.parse(workflow.merge(undefined)!);
  expect(data.jobs.workspace.steps.some((step: { run?: string }) => step.run?.includes("pnpm build && pnpm test"))).toBe(true);
  const sel = defaultSelections(kit);
  expect(() => selectionsFrom(kit, { base: sel, options: { "web.nextjs.deploy": ["vercel"] } }, { requirements: "throw" })).toThrow();
  const independent = selectionsFrom(kit, { base: sel, options: { deployment: ["independent"], "web.nextjs.deploy": ["vercel"] } }, { requirements: "throw" }).selections;
  expect(buildPlan({ kit, kitDir: "", sel: independent, parentDir: "/tmp", name: "hosted", git: false }).some((step) => step.kind === "write" && step.path.endsWith("apps/web/vercel.json"))).toBe(true);
});

it("translates old Turbo configurations without changing their service choices", async () => {
  const turbo = await loadKitFrom(await source.read("monorepo-turbo"), source);
  const sel = selectionsFrom(turbo, { options: { web: ["vite"], apps: ["api", "docs"] } }, { requirements: "throw" }).selections;
  expect(selectedServices(turbo, sel).map((service) => [service.id, service.variant])).toEqual([["web", "react"], ["api", "hono"], ["docs", "starlight"]]);
  const empty = selectionsFrom(turbo, { options: { web: ["next"], apps: [] } }).selections;
  expect(selectedServices(turbo, empty).map((service) => service.id)).toEqual(["web"]);
});
