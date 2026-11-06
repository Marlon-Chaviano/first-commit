import { describe, expect, it } from "vitest";

import { mergeKits, resolveExtends, splitKitRef, type LoadedRawKit } from "./extends";

const join = (dir: string, path: string) => (path.startsWith("/") ? path : `${dir}/${path}`);

const parent = {
  name: "landing-next",
  version: "1.0.0",
  title: "Landing",
  description: "Base",
  category: "landing",
  author: "kits",
  base: { command: "create-next-app {{name}}" },
  dependencies: ["motion"],
  skills: ["a/b@one"],
  env: { A: "1" },
  libraries: { framework: "react", components: "shadcn", animation: ["motion"] },
  instructions: "## Padre",
  options: [
    { id: "ui", label: "UI", default: "x", choices: [{ id: "x", label: "X" }] },
    { id: "extras", label: "Extras", default: "y", choices: [{ id: "y", label: "Y", files: "files/y" }] },
  ],
};

describe("mergeKits", () => {
  const child = {
    name: "landing-dark",
    version: "0.1.0",
    extends: "landing-next",
    title: "Oscura",
    dependencies: ["motion", "gsap"],
    skills: ["a/b@two"],
    env: { B: "2" },
    libraries: { addons: ["magicui"] },
    instructions: "## Hijo",
    options: [
      { id: "ui", label: "UI nueva", default: "z", choices: [{ id: "z", label: "Z" }] },
      { id: "theme", label: "Tema", default: "dark", choices: [{ id: "dark", label: "Oscuro" }] },
    ],
  };
  const merged = mergeKits(parent, child);

  it("keeps the child's identity and drops `extends`", () => {
    expect(merged.name).toBe("landing-dark");
    expect(merged.version).toBe("0.1.0");
    expect(merged).not.toHaveProperty("extends");
  });

  it("overrides scalars and inherits the rest", () => {
    expect(merged.title).toBe("Oscura");
    expect(merged.description).toBe("Base");
    expect(merged.base).toEqual(parent.base);
  });

  it("concatenates lists without duplicates", () => {
    expect(merged.dependencies).toEqual(["motion", "gsap"]);
    expect(merged.skills).toEqual(["a/b@one", "a/b@two"]);
  });

  it("merges objects key by key", () => {
    expect(merged.env).toEqual({ A: "1", B: "2" });
    expect(merged.libraries).toEqual({ framework: "react", components: "shadcn", animation: ["motion"], addons: ["magicui"] });
  });

  it("appends instructions", () => {
    expect(merged.instructions).toBe("## Padre\n\n## Hijo");
  });

  it("replaces options by id and appends new ones", () => {
    const options = merged.options as { id: string; label: string }[];
    expect(options.map((o) => o.id)).toEqual(["ui", "extras", "theme"]);
    expect(options[0]!.label).toBe("UI nueva");
  });

  it("lets a child change only an option's default", () => {
    const out = mergeKits(
      { options: [{ id: "styling", label: "Estilos", default: "css", choices: [{ id: "css" }, { id: "tw" }] }] },
      { options: [{ id: "styling", default: "tw" }] },
    );
    expect(out.options).toEqual([{ id: "styling", label: "Estilos", default: "tw", choices: [{ id: "css" }, { id: "tw" }] }]);
  });
});

describe("resolveExtends", () => {
  const kits: Record<string, LoadedRawKit> = {
    "landing-next": { raw: parent, dir: "/registry/landing-next" },
  };
  const load = async (ref: string) => {
    const kit = kits[splitKitRef(ref).base];
    if (!kit) throw new Error(`missing ${ref}`);
    return kit;
  };

  it("makes each kit's `files` absolute to its own folder", async () => {
    const child = { raw: { name: "c", version: "1.0.0", extends: "landing-next", files: "files" }, dir: "/me/c" };
    const merged = await resolveExtends(child, load, join);
    expect(merged.files).toBe("/me/c/files");
    const extras = (merged.options as { id: string; choices: { files?: string }[] }[]).find((o) => o.id === "extras")!;
    expect(extras.choices[0]!.files).toBe("/registry/landing-next/files/y");
  });

  it("detects cycles by folder, even through different refs", async () => {
    const a: LoadedRawKit = { raw: { name: "a", version: "1.0.0", extends: "../b" }, dir: "/k/a" };
    const b: LoadedRawKit = { raw: { name: "b", version: "1.0.0", extends: "../a" }, dir: "/k/b" };
    const loader = async (ref: string) => (ref === "../b" ? b : a);
    await expect(resolveExtends(a, loader, join)).rejects.toThrow(/cycle/);
  });

  it("limits the depth of the chain", async () => {
    const level = (n: number): LoadedRawKit => ({ raw: { name: `k${n}`, version: "1.0.0", extends: `k${n + 1}` }, dir: `/k/${n}` });
    await expect(resolveExtends(level(0), async (ref) => level(Number(ref.slice(1))), join)).rejects.toThrow(/levels/);
  });
});

describe("splitKitRef", () => {
  it.each([
    ["landing-next", { base: "landing-next" }],
    ["landing-next@1.2.0", { base: "landing-next", version: "1.2.0" }],
    ["user/repo/kit@v2.0.0", { base: "user/repo/kit", version: "v2.0.0" }],
    ["./local/kit", { base: "./local/kit" }],
  ])("%s", (ref, expected) => {
    expect(splitKitRef(ref)).toEqual(expected);
  });
});
