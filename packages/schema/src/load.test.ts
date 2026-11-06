import { describe, expect, it } from "vitest";

import { isOfficialKitName, loadKitFrom, type KitSource } from "./load";

const base = { version: "1.0.0", title: "K", description: "", category: "web", author: "a", base: { command: "mkdir {{name}}" } };
// In-memory source: what a test, the website or the CLI plug in.
const source = (kits: Record<string, Record<string, unknown>>): KitSource => ({
  read: async (ref) => ({ raw: kits[ref] ?? Promise.reject(new Error(`no ${ref}`)), dir: `/kits/${ref}` }) as never,
  catalog: async () => [],
  resolvePath: (dir, path) => `${dir}/${path}`,
});

describe("loadKitFrom", () => {
  it("resolves `extends` before parsing, so a child can omit what it inherits", async () => {
    const kits = { parent: { ...base, name: "parent", tags: ["a"] } };
    const kit = await loadKitFrom({ raw: { name: "child", version: "1.0.0", extends: "parent", tags: ["b"] }, dir: "/kits/child" }, source(kits));
    expect(kit.title).toBe("K");
    expect(kit.tags).toEqual(["a", "b"]);
  });

  it("admit: rejects a kit whose defaults aren't a valid combination", async () => {
    const raw = {
      ...base,
      name: "bad",
      options: [
        { id: "db", label: "DB", default: "none", choices: [{ id: "none", label: "-" }, { id: "pg", label: "PG" }] },
        { id: "auth", label: "Auth", default: "better-auth", choices: [{ id: "better-auth", label: "BA", requires: { db: ["pg"] } }] },
      ],
    };
    await expect(loadKitFrom({ raw, dir: "/kits/bad" }, source({}))).resolves.toBeDefined();
    await expect(loadKitFrom({ raw, dir: "/kits/bad" }, source({}), { admit: true })).rejects.toThrow(/auth/);
  });
});

describe("isOfficialKitName", () => {
  it.each([["landing-next", true], ["landing-next@1.2.0", true], ["ana/landing", false], ["./kit", false]])("%s → %s", (ref, official) => {
    expect(isOfficialKitName(ref)).toBe(official);
  });
});
