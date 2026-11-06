import { readFileSync } from "node:fs";
import { join } from "node:path";

import { catalogSchema, recommendHeuristic, resolveRecommendation, type Kit, type RegistryEntry } from "@kits/schema";
import { loadRegistryKits } from "@kits/schema/node";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { describe, expect, it } from "vitest";

import { createKitsServer, describeSteps, selectionsFor, type KitsSource, type LocalActions } from "./index";

const registry = join(__dirname, "../../../registry");
const catalog = catalogSchema.parse(JSON.parse(readFileSync(join(registry, "libraries.json"), "utf8")));
// Kits as the registry serves them: `extends` resolved, catalog libraries expanded.
const kits: Kit[] = await loadRegistryKits(registry);
const entries = JSON.parse(readFileSync(join(registry, "index.json"), "utf8")) as RegistryEntry[];

const source: KitsSource = {
  entries: async () => entries,
  catalog: async () => catalog,
  kit: async (ref) => {
    const kit = kits.find((k) => k.name === ref);
    if (!kit) throw new Error(`No existe el kit "${ref}"`);
    return kit;
  },
  recommend: async (description) => {
    const rec = recommendHeuristic(description, kits);
    return resolveRecommendation(kits.find((k) => k.name === rec.kit)!, rec, "heuristic");
  },
};

/** Minimal MCP client over an in-memory pair. */
async function connect(local?: LocalActions) {
  const [client, server] = InMemoryTransport.createLinkedPair();
  await createKitsServer({ source, version: "0.0.0", local, cwd: "/work" }).connect(server);
  const pending = new Map<number, (m: { result?: any; error?: any }) => void>();
  client.onmessage = (m: any) => pending.get(m.id)?.(m);
  await client.start();
  let id = 0;
  const request = (method: string, params: object) =>
    new Promise<{ result?: any; error?: any }>((done) => {
      pending.set(++id, done);
      void client.send({ jsonrpc: "2.0", id, method, params } as never);
    });
  await request("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } });
  await client.send({ jsonrpc: "2.0", method: "notifications/initialized" } as never);
  const call = async (name: string, args: object) => {
    const { result } = await request("tools/call", { name, arguments: args });
    return { isError: Boolean(result.isError), text: result.content[0].text as string };
  };
  return { request, call };
}

describe("kits MCP server", () => {
  it("exposes only read-only tools without local actions", async () => {
    const { request } = await connect();
    const { result } = await request("tools/list", {});
    expect(result.tools.map((t: { name: string }) => t.name)).toEqual(["search_kits", "get_kit", "recommend_kit", "plan_init"]);
  });

  it("adds init_kit and add_library locally", async () => {
    const { request } = await connect({ init: async () => "", add: async () => "" });
    const { result } = await request("tools/list", {});
    expect(result.tools.map((t: { name: string }) => t.name)).toEqual(expect.arrayContaining(["init_kit", "add_library"]));
  });

  it("searches by library name", async () => {
    const { call } = await connect();
    const found = JSON.parse((await call("search_kits", { query: "stripe" })).text) as { kit: string }[];
    expect(found.map((k) => k.kit)).toContain("saas-next-supabase");
    expect(found.map((k) => k.kit)).not.toContain("api-go");
  });

  it("recommends with a ready-to-run command", async () => {
    const { call } = await connect();
    const rec = JSON.parse((await call("recommend_kit", { description: "landing page with animations" })).text);
    expect(rec.kit).toBe("landing-next");
    expect(rec.command).toMatch(/create-first-commit@latest landing-next/);
  });

  it("plans without running and rejects unknown options", async () => {
    const { call } = await connect();
    const plan = JSON.parse((await call("plan_init", { kit: "api-go", name: "svc" })).text);
    expect(plan.steps[0]).toMatch(/go mod init svc/);
    expect((await call("plan_init", { kit: "api-go", name: "svc", options: { nope: ["x"] } })).isError).toBe(true);
  });

  it("init_kit requires approval and passes --yes", async () => {
    const runs: string[][] = [];
    const { call } = await connect({ init: async (args) => (runs.push(args), "ok"), add: async () => "" });
    expect((await call("init_kit", { kit: "landing-next", name: "web" })).isError).toBe(true);
    expect(runs).toHaveLength(0);
    await call("init_kit", { kit: "landing-next", name: "web", options: { animation: ["gsap"] }, approved: true });
    expect(runs[0]).toEqual(["init", "landing-next", "web", "--animation", "gsap", "--yes"]);
  });
});

describe("helpers", () => {
  const kit = kits.find((k) => k.name === "saas-next-supabase")!;

  it("selectionsFor checks requirements and package managers", () => {
    expect(() => selectionsFor(kit, { options: { auth: ["better-auth"] } })).toThrow(/database/);
    expect(() => selectionsFor(kit, { pm: "go" })).toThrow(/supports/);
    expect(selectionsFor(kit, { options: { auth: ["better-auth"], database: ["drizzle-postgres"] } }).options.auth).toEqual(["better-auth"]);
  });

  it("describeSteps makes paths relative to the working directory", () => {
    expect(describeSteps([{ kind: "write", title: "Crear archivo", path: "/work/app/a.ts", merge: () => "" }], "/work")).toEqual(["Crear archivo app/a.ts"]);
  });
});
