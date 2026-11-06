import { describe, expect, it, test } from "vitest";

import { applyWrite, buildPlan, mergeJson } from "./plan";
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
