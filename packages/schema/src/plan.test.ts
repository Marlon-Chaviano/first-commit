import { describe, expect, it, test } from "vitest";

import { addReadmeBadge, applyWrite, buildPlan, mergeJson, readmeBadge } from "./plan";
import { defaultSelections } from "./resolve";
import { parseKit } from "./schema";

describe("applyWrite", () => {
  it("create: writes a new file and never overwrites", () => {
    const merge = applyWrite({ path: "a.ts", content: "new", mode: "create" });
    expect(merge(undefined)).toBe("new\n");
    expect(merge("mine\n")).toBe("mine\n");
  });

  it("append: adds once, even if run twice", () => {
    const merge = applyWrite({ path: "a.ts", content: "import x;", mode: "append" });
    const once = merge("first\n");
    expect(once).toBe("first\n\nimport x;\n");
    expect(merge(once)).toBe(once);
  });

  it("prepend: adds at the top once", () => {
    const merge = applyWrite({ path: "a.ts", content: 'import "./sentry";', mode: "prepend" });
    const once = merge("rest\n");
    expect(once).toBe('import "./sentry";\nrest\n');
    expect(merge(once)).toBe(once);
  });

  it("insert-before: inserts before the anchor and fails without it", () => {
    const merge = applyWrite({ path: "layout.tsx", content: "<Analytics />", mode: "insert-before", anchor: "</body>" });
    expect(merge("<body>{children}</body>")).toBe("<body>{children}<Analytics />\n</body>");
    expect(() => merge("<main />")).toThrow(/Couldn't find/);
    expect(() => merge(undefined)).toThrow(/doesn't exist/);
  });
});

describe("json-merge", () => {
  const merge = applyWrite({ path: "package.json", content: JSON.stringify({ scripts: { test: "vitest", build: "x" }, keywords: ["b"] }), mode: "json-merge" });

  it("adds missing keys and keeps the user's values", () => {
    const out = JSON.parse(merge(JSON.stringify({ name: "app", scripts: { build: "next build" }, keywords: ["a"] }))!);
    expect(out).toEqual({ name: "app", scripts: { build: "next build", test: "vitest" }, keywords: ["a", "b"] });
  });

  it("is idempotent", () => {
    const once = merge(JSON.stringify({ scripts: {} }));
    expect(merge(once)).toBe(once);
  });

  it("refuses JSON with comments", () => {
    expect(() => merge('{ // comment\n }')).toThrow(/valid JSON/);
  });

  it("mergeJson unions arrays by value", () => {
    expect(mergeJson([{ a: 1 }], [{ a: 1 }, { a: 2 }])).toEqual([{ a: 1 }, { a: 2 }]);
  });
});

test("finalize runs after every choice's setup, and isn't optional", () => {
  const kit = parseKit({
    name: "mono",
    version: "1.0.0",
    title: "Mono",
    description: "",
    category: "monorepo",
    author: "a",
    base: { command: "mkdir {{name}}" },
    postInstall: ["echo kit"],
    finalize: ["{{pm}} install"],
    options: [{ id: "web", label: "Web", default: "next", choices: [{ id: "next", label: "Next", postInstall: ["echo web"] }] }],
  });
  const steps = buildPlan({ kit, kitDir: "/k", sel: defaultSelections(kit), parentDir: "/tmp", name: "app", git: false });
  const runs = steps.filter((s) => s.kind === "run").map((s) => (s as { command: string; optional?: boolean }));
  // Skills are installed afterwards.
  expect(runs.slice(0, 4).map((s) => s.command)).toEqual(["mkdir app", "echo kit", "echo web", "npm install"]);
  expect(runs[3]?.optional).toBeFalsy();
});

describe("brand step", () => {
  const kit = parseKit({ name: "demo", version: "1.0.0", title: "Demo", description: "", category: "web", author: "a", base: { command: "mkdir {{name}}" } });
  const plan = (brand?: Parameters<typeof buildPlan>[0]["brand"]) => buildPlan({ kit, kitDir: "kit", sel: defaultSelections(kit), parentDir: ".", name: "app", git: true, brand });

  it("goes after the kit's files and before the initial commit", () => {
    const steps = plan({ ref: "acme/web", title: "Acme", images: ["logo", "icon"] });
    expect(steps.map((s) => s.kind).slice(-2)).toEqual(["brand", "git"]);
    expect(steps.at(-2)).toMatchObject({ kind: "brand", title: "Apply the Acme brand", ref: "acme/web", images: ["Logo", "Favicon"] });
  });

  it("names the ref when the profile isn't known, and is absent without --brand", () => {
    expect(plan({ ref: "acme/web" }).at(-2)).toMatchObject({ title: "Apply brand acme/web", images: [] });
    expect(plan().some((s) => s.kind === "brand")).toBe(false);
  });
});

describe("README badge", () => {
  const kit = parseKit({ name: "demo", version: "1.0.0", title: "Demo", description: "", category: "web", author: "a", base: { command: "mkdir {{name}}" } });
  const badge = readmeBadge("landing-next");

  it("links the badge to the kit, and local kits to the site", () => {
    expect(badge).toBe("[![Started with first-commit](https://first-commit.dev/badge/started.svg)](https://first-commit.dev/kits/landing-next?ref=badge)");
    expect(readmeBadge("ana/landing")).toContain("/kits/ana/landing?ref=badge");
    expect(readmeBadge("./kit")).toContain("](https://first-commit.dev/?ref=badge)");
  });

  it("goes under the title, keeps the rest and is never added twice", () => {
    const merge = addReadmeBadge(badge, "app");
    const once = merge("# My app\n\nWhat it does.\n")!;
    expect(once).toBe(`# My app\n\n<!-- first-commit:badge -->\n${badge}\n<!-- /first-commit:badge -->\n\nWhat it does.\n`);
    expect(merge(once)).toBe(once);
  });

  it("creates a README when there isn't one, and goes first when there's no title", () => {
    const merge = addReadmeBadge(badge, "app");
    expect(merge(undefined)).toBe(`# app\n\n<!-- first-commit:badge -->\n${badge}\n<!-- /first-commit:badge -->\n`);
    expect(merge("Some notes.\n")).toMatch(/^<!-- first-commit:badge -->/);
  });

  it("is a step of the plan unless --no-badge", () => {
    const plan = (sel = defaultSelections(kit)) => buildPlan({ kit, kitDir: "kit", sel, parentDir: ".", name: "app", git: true, kitRef: "demo" });
    expect(plan().find((s) => s.title === "Add the first-commit badge to README.md")).toMatchObject({ kind: "write", path: "./app/README.md", optional: true });
    expect(plan({ ...defaultSelections(kit), badge: false }).some((s) => s.title.includes("badge"))).toBe(false);
  });
});
