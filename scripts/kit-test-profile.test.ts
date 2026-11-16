import { fileURLToPath } from "node:url";

import { loadKitFrom } from "@kits/schema";
import { registrySource } from "@kits/schema/node";
import { expect, it } from "vitest";

import { kitTestProfile } from "./kit-test-profile";

const source = registrySource(fileURLToPath(new URL("../registry", import.meta.url)));
const load = async (name: string) => loadKitFrom(await source.read(name), source);

it("preserves the root package manager for standalone and native kits", async () => {
  expect(kitTestProfile(await load("api-rails"))).toEqual({ pm: "bundler", pms: ["bundler"] });
  expect(kitTestProfile(await load("monorepo-go"))).toEqual({ pm: "go", pms: ["go"] });
});

it("installs Rails for its service while running the workspace with pnpm", async () => {
  const profile = kitTestProfile(await load("monorepo-rails-react"));
  expect(profile.pm).toBe("pnpm");
  expect(profile.pms).toContain("bundler");
  expect(profile.pms).not.toContain("maven");
});

it("includes services selected only by the verification matrix", async () => {
  const kit = await load("monorepo");
  kit.verify = { ...kit.verify, matrix: [{ api: ["rails"] }, { api: ["spring"] }] };
  const profile = kitTestProfile(kit);
  expect(profile.pms).toEqual(expect.arrayContaining(["pnpm", "pip", "bundler", "maven"]));
  expect(profile.pms).not.toContain("cargo");
});
