import type { RegistryEntry } from "@kits/schema";
import { describe, expect, it } from "vitest";

import { facets, queryKits, suggestKits } from "./kit-query";

const entry = (name: string, extra: Partial<RegistryEntry> = {}): RegistryEntry => ({
  name,
  version: "1.0.0",
  title: name,
  description: "",
  category: "web",
  tags: [],
  author: "a",
  skills: 0,
  options: [],
  official: true,
  ...extra,
});

const kits = [
  entry("landing-next", { category: "landing", libraries: ["Stripe"] }),
  entry("api-go", { category: "api", language: "go" }),
  entry("ana/blog", { official: false, tags: ["blog"] }),
];
const ranking = { counts: { "api-go": 5, "ana/blog": 9 }, verified: { "api-go": true } };

describe("queryKits", () => {
  it("ranks by installs, then by name", () => {
    expect(queryKits(kits, {}, ranking).map((k) => k.name)).toEqual(["ana/blog", "api-go", "landing-next"]);
  });

  it("as a catalog: by category, the general-purpose kit first, then by name", () => {
    const catalog = [...kits, entry("landing-astro", { category: "landing" }), entry("api-hono", { category: "api" })];
    expect(queryKits(catalog, { sort: "catalog" }, ranking).map((k) => k.name).filter((n) => n !== "ana/blog")).toEqual(["landing-next", "landing-astro", "api-hono", "api-go"]);
  });

  it("searches name, tags and libraries, ignoring case", () => {
    expect(queryKits(kits, { q: "STRIPE" }, ranking).map((k) => k.name)).toEqual(["landing-next"]);
    expect(queryKits(kits, { q: " blog " }, ranking).map((k) => k.name)).toEqual(["ana/blog"]);
  });

  it("filters by origin, category and language", () => {
    expect(queryKits(kits, { origin: "community" }, ranking).map((k) => k.name)).toEqual(["ana/blog"]);
    expect(queryKits(kits, { origin: "verified" }, ranking).map((k) => k.name)).toEqual(["api-go"]);
    expect(queryKits(kits, { category: "landing" }, ranking).map((k) => k.name)).toEqual(["landing-next"]);
    // Entries without a language are TypeScript.
    expect(queryKits(kits, { language: "typescript" }, ranking).map((k) => k.name)).toEqual(["ana/blog", "landing-next"]);
  });
});

describe("facets", () => {
  it("lists the categories with kits and counts kits per language", () => {
    const { categories, languages } = facets(kits);
    expect(categories).toEqual(["landing", "api", "web"]);
    expect(languages.find((l) => l.id === "go")?.count).toBe(1);
    expect(languages.find((l) => l.id === "typescript")?.count).toBe(2);
    expect(languages.find((l) => l.id === "rust")?.count).toBe(0);
  });
});

describe("suggestKits", () => {
  const catalog = [
    entry("saas-next-supabase", { category: "saas", tags: ["supabase", "stripe"] }),
    entry("api-fastapi", { category: "api", language: "python", tags: ["fastapi"] }),
    entry("landing-next", { category: "landing", libraries: ["Stripe"] }),
  ];

  it("finds kits through a typo in a name, tag or library", () => {
    expect(suggestKits(catalog, "supbase")[0]).toMatchObject({ kit: { name: "saas-next-supabase" }, word: "supabase" });
    expect(suggestKits(catalog, "fastpi")[0]?.kit.name).toBe("api-fastapi");
  });

  it("suggests nothing for unrelated words or very short ones", () => {
    expect(suggestKits(catalog, "zzzzzz")).toEqual([]);
    expect(suggestKits(catalog, "ab")).toEqual([]);
  });
});
