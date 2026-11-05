import { describe, expect, it } from "vitest";

import { applyWrite, mergeJson } from "./plan";

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
    expect(() => merge("<main />")).toThrow(/No se encontró/);
    expect(() => merge(undefined)).toThrow(/No existe/);
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
    expect(() => merge('{ // comment\n }')).toThrow(/JSON válido/);
  });

  it("mergeJson unions arrays by value", () => {
    expect(mergeJson([{ a: 1 }], [{ a: 1 }, { a: 2 }])).toEqual([{ a: 1 }, { a: 2 }]);
  });
});
