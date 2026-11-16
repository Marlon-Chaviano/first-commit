import { fileURLToPath } from "node:url";
import { beforeEach, expect, it, vi } from "vitest";
import { buildPlan, loadKitFrom, selectionsFrom } from "@kits/schema";
import { registrySource } from "@kits/schema/node";

vi.mock("@/server/registry", () => ({ getKitPage: vi.fn() }));
vi.mock("@/server/session", () => ({ getViewer: vi.fn(async () => null) }));
vi.mock("@/server/kit-access", () => ({ canReadKit: vi.fn(async () => false) }));
import { getKitPage } from "@/server/registry";
import { canReadKit } from "@/server/kit-access";
import { previewPlan } from "./plan-actions";

const source = registrySource(fileURLToPath(new URL("../../../../../registry", import.meta.url)));
const kit = await loadKitFrom(await source.read("monorepo"), source);
const selections = selectionsFrom(kit, { options: { api: ["django"] } }).selections;
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getKitPage).mockResolvedValue({ kit, meta: { slug: "monorepo", version: kit.version, official: true, visibility: "public" } });
});

it("returns the actual CLI plan without executable merge functions", async () => {
  const result = await previewPlan({ kit: "monorepo", selections, name: "demo" });
  const expected = buildPlan({ kit, kitDir: "kit", kitRef: "monorepo", sel: selections, parentDir: ".", name: "demo", git: true });
  expect("steps" in result && result.steps.map((step) => step.title)).toEqual(expected.map((step) => step.title));
  expect("steps" in result && result.steps.some((step) => "merge" in step)).toBe(false);
});

it("does not disclose a private kit's plan to a non-member", async () => {
  vi.mocked(getKitPage).mockResolvedValue({ kit, meta: { slug: "team/private", version: kit.version, official: false, visibility: "org", orgId: "team" } });
  expect(await previewPlan({ kit: "team/private", selections })).toEqual({ error: "Kit not found" });
  expect(canReadKit).toHaveBeenCalled();
});

it("rejects incompatible library selections instead of producing a misleading preview", async () => {
  const result = await previewPlan({ kit: "monorepo", selections: { ...selections, options: { ...selections.options, "api.fastapi.database": ["sqlmodel"] } } });
  expect(result).toHaveProperty("error");
});
