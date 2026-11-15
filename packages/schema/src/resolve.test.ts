import { describe, expect, it } from "vitest";

import { expandKit, type Catalog } from "./libraries";
import { buildInitCommand, defaultSelections, pruneSelections, resolve, validateSelections } from "./resolve";
import { parseKit } from "./schema";

const catalog: Catalog = [
  { id: "shadcn", name: "shadcn/ui", kind: "components", frameworks: ["react"], url: "https://ui.shadcn.com", description: "", usage: "npx shadcn add" },
  { id: "primevue", name: "PrimeVue", kind: "components", frameworks: ["vue"], url: "https://primevue.org", description: "", usage: "import", dependencies: ["primevue"] },
  { id: "kokonutui", name: "Kokonut UI", kind: "addon", frameworks: ["react"], url: "https://kokonutui.com", description: "", usage: "npx shadcn add @kokonutui/x", requires: { components: ["shadcn"] } },
  { id: "motion", name: "Motion", kind: "animation", frameworks: ["react", "vanilla"], url: "https://motion.dev", description: "", usage: "motion", dependencies: ["motion"] },
  {
    id: "sentry-nextjs", name: "Sentry", kind: "observability", frameworks: ["nextjs"], url: "https://sentry.io", description: "", usage: "Sentry",
    setup: "pon el DSN", setupTasks: ["sube source maps"], writeFiles: [{ path: "src/instrumentation.ts", content: "x" }],
  },
].map((l) => ({ dependencies: [], devDependencies: [], skills: [], mcp: {}, env: {}, postInstall: [], writeFiles: [], setupTasks: [], ...l })) as Catalog;

const base = {
  version: "1.0.0",
  title: "T",
  description: "D",
  category: "web",
  author: "a",
  base: { command: "create {{name}}" },
};

describe("library options", () => {
  const kit = expandKit(
    parseKit({ ...base, name: "web", libraries: { framework: ["react", "nextjs"], components: "shadcn", addons: [], animation: ["motion"], observability: [] } }),
    catalog,
  );

  it("offers only libraries for the kit's frameworks", () => {
    const components = kit.options.find((o) => o.id === "components")!;
    expect(components.choices.map((c) => c.id)).toEqual(["none", "shadcn"]);
  });

  it("turns `setup` into a setup task and keeps writeFiles", () => {
    const sel = { ...defaultSelections(kit), options: { ...defaultSelections(kit).options, observability: ["sentry-nextjs"] } };
    const r = resolve(kit, sel);
    expect(r.setupTasks).toEqual(["Sentry: pon el DSN", "sube source maps"]);
    expect(r.writeFiles.map((f) => f.path)).toEqual(["src/instrumentation.ts"]);
  });

  it("rejects an add-on whose requirement isn't selected", () => {
    const sel = defaultSelections(kit);
    sel.options.components = ["none"];
    sel.options["component-addons"] = ["kokonutui"];
    expect(() => validateSelections(kit, sel)).toThrow(/needs --components shadcn/);
  });

  it("prunes choices that stop being valid", () => {
    const sel = defaultSelections(kit);
    sel.options["component-addons"] = ["kokonutui"];
    sel.options.components = ["none"];
    expect(pruneSelections(kit, sel).options["component-addons"]).toEqual([]);
  });
});

describe("framework chosen by an option", () => {
  const kit = expandKit(
    parseKit({
      ...base,
      name: "ext",
      options: [{ id: "framework", label: "F", default: "react", choices: [{ id: "react", label: "React" }, { id: "vue", label: "Vue" }] }],
      libraries: { framework: { option: "framework" }, components: "shadcn", animation: [] },
    }),
    catalog,
  );

  it("falls back to an allowed choice when the framework changes", () => {
    const sel = defaultSelections(kit);
    sel.options.framework = ["vue"];
    expect(pruneSelections(kit, sel).options.components).toEqual(["none"]);
  });

  it("allows Vue libraries only with Vue", () => {
    const sel = defaultSelections(kit);
    sel.options.components = ["primevue"];
    expect(() => validateSelections(kit, sel)).toThrow(/--framework vue/);
    sel.options.framework = ["vue"];
    expect(() => validateSelections(kit, sel)).not.toThrow();
  });

  it("keeps universal packs available when the framework is chosen by an option", () => {
    const universal = { ...catalog[0]!, id: "security-pack", kind: "security" as const, frameworks: ["any"] as const };
    const kit = expandKit(parseKit({
      ...base, name: "universal",
      options: [{ id: "runtime", label: "Runtime", default: "nodejs", choices: [{ id: "nodejs", label: "Node" }, { id: "bun", label: "Bun" }] }],
      libraries: { framework: { option: "runtime" }, security: ["security-pack"] },
    }), [{ ...universal, frameworks: [...universal.frameworks] }]);
    for (const runtime of ["nodejs", "bun"]) {
      const selected = { ...defaultSelections(kit), options: { runtime: [runtime], security: ["security-pack"] } };
      expect(() => validateSelections(kit, selected)).not.toThrow();
      expect(pruneSelections(kit, selected).options.security).toEqual(["security-pack"]);
    }
  });

  it("keeps extension publishing independent of the selected renderer and hides web hosting", () => {
    const store = { ...catalog[0]!, id: "chrome-store", name: "Chrome Web Store", kind: "deploy" as const, frameworks: ["browser-extension"] as Catalog[number]["frameworks"] };
    const hosting = { ...store, id: "web-hosting", name: "Web hosting", frameworks: ["react", "vue"] as Catalog[number]["frameworks"], excludeFrameworks: ["browser-extension"] as Catalog[number]["frameworks"] };
    const extension = expandKit(parseKit({
      ...base, name: "extension",
      options: [{ id: "renderer", label: "Renderer", default: "react", choices: [{ id: "react", label: "React" }, { id: "vue", label: "Vue" }] }],
      libraries: { framework: { option: "renderer" }, platforms: ["browser-extension"], deploy: "chrome-store" },
    }), [store, hosting]);
    expect(extension.options.find((o) => o.id === "deploy")!.choices.map((c) => c.id)).toEqual(["none", "chrome-store"]);
    for (const renderer of ["react", "vue"]) {
      const sel = { ...defaultSelections(extension), options: { renderer: [renderer], deploy: ["chrome-store"] } };
      expect(() => validateSelections(extension, sel)).not.toThrow();
      expect(pruneSelections(extension, sel).options.deploy).toEqual(["chrome-store"]);
    }
  });
});

describe("buildInitCommand", () => {
  const kit = expandKit(parseKit({ ...base, name: "web", libraries: { framework: "react", components: "shadcn", animation: [] } }), catalog);

  it("is short with defaults", () => {
    expect(buildInitCommand("web", kit, defaultSelections(kit))).toBe("npx create-first-commit@latest web");
  });

  it("only includes what differs", () => {
    const sel = defaultSelections(kit);
    sel.options.animation = ["motion"];
    sel.pm = "pnpm";
    expect(buildInitCommand("web", kit, sel, "app")).toBe("npx create-first-commit@latest web app --animation motion --pm pnpm");
  });
});

describe("library labels", () => {
  it("adds the platform when two choices share a name", () => {
    const sentry = (id: string, fw: string) => ({ ...catalog[0]!, id, name: "Sentry", kind: "observability" as const, frameworks: [fw] as Catalog[number]["frameworks"] });
    const kit = expandKit(
      parseKit({
        ...base,
        name: "api",
        options: [{ id: "runtime", label: "R", default: "nodejs", choices: [{ id: "nodejs", label: "Node" }, { id: "bun", label: "Bun" }] }],
        libraries: { framework: { option: "runtime" }, observability: [] },
      }),
      [sentry("sentry-node", "nodejs"), sentry("sentry-bun", "bun")],
    );
    expect(kit.options.find((o) => o.id === "observability")!.choices.map((c) => c.label)).toEqual(["Sentry (Node.js)", "Sentry (Bun)"]);
  });
});

describe("catalog categories", () => {
  const more = [
    { id: "drizzle-postgres", name: "Drizzle", kind: "database", frameworks: ["nextjs"], url: "https://orm.drizzle.team", description: "", usage: "db" },
    { id: "better-auth", name: "Better Auth", kind: "auth", frameworks: ["nextjs"], url: "https://better-auth.com", description: "", usage: "auth", requires: { database: ["drizzle-postgres"] } },
    { id: "sentry-go", name: "Sentry", kind: "observability", frameworks: ["go"], url: "https://sentry.io", description: "", usage: "go" },
  ].map((l) => ({ dependencies: [], devDependencies: [], skills: [], mcp: {}, env: {}, postInstall: [], writeFiles: [], setupTasks: [], ...l })) as Catalog;
  const full = [...catalog, ...more];

  it("turns each declared category into an option with a `none` choice for selects", () => {
    const kit = expandKit(parseKit({ ...base, name: "saas", libraries: { framework: ["react", "nextjs"], auth: "none", database: "none" } }), full);
    expect(kit.options.find((o) => o.id === "auth")!.choices.map((c) => c.id)).toEqual(["none", "better-auth"]);
    expect(kit.options.find((o) => o.id === "database")!.type).toBe("select");
    const sel = defaultSelections(kit);
    expect(() => validateSelections(kit, { ...sel, options: { ...sel.options, auth: ["better-auth"] } })).toThrow(/database/);
    expect(() => validateSelections(kit, { ...sel, options: { ...sel.options, auth: ["better-auth"], database: ["drizzle-postgres"] } })).not.toThrow();
  });

  it("offers Go variants only to Go kits", () => {
    const kit = expandKit(parseKit({ ...base, name: "api", packageManagers: ["go"], libraries: { framework: "go", observability: [] } }), full);
    expect(kit.options.find((o) => o.id === "observability")!.choices.map((c) => c.id)).toEqual(["sentry-go"]);
  });

  it("rejects a kit option that collides with a category", () => {
    const kit = parseKit({
      ...base,
      name: "x",
      options: [{ id: "auth", label: "Auth", default: "a", choices: [{ id: "a", label: "A" }] }],
      libraries: { framework: ["nextjs"], auth: "none" },
    });
    expect(() => expandKit(kit, full)).toThrow(/clashes/);
  });
});

describe("writeFiles paths", () => {
  const kitWith = (path: string) => () => parseKit({ ...base, name: "p", writeFiles: [{ path, content: "x" }] });
  it("allows catch-all route segments", () => expect(kitWith("src/app/api/auth/[...all]/route.ts")).not.toThrow());
  it.each(["../x", "a/../b", "a/..", "/etc/passwd"])("rejects %s", (path) => expect(kitWith(path)).toThrow());
});
