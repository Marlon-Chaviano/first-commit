import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { catalogSchema, expandKit } from "./libraries";
import { recommendHeuristic, resolveRecommendation } from "./recommend";
import { parseKit } from "./schema";

// The real registry: the recommender is only as good as the catalog it reads.
const registry = join(__dirname, "../../../registry");
const catalog = catalogSchema.parse(JSON.parse(readFileSync(join(registry, "libraries.json"), "utf8")));
const kits = readdirSync(join(registry, "kits")).map((name) =>
  expandKit(parseKit(JSON.parse(readFileSync(join(registry, "kits", name, "kit.json"), "utf8"))), catalog),
);
const recommend = (description: string) => {
  const rec = recommendHeuristic(description, kits);
  return resolveRecommendation(kits.find((k) => k.name === rec.kit)!, rec, "heuristic");
};

describe("recommendHeuristic", () => {
  it.each([
    ["Una landing para lanzar mi app, con animaciones y analítica", "landing-next"],
    ["App móvil de recetas para iOS y Android con login", "mobile-expo"],
    ["SaaS de reservas para peluquerías con pagos y emails", "saas-next-supabase"],
    ["API REST en Python para un inventario", "api-fastapi"],
    ["Un microservicio en Go", "api-go"],
    ["App nativa de iOS con SwiftUI", "ios-swiftui"],
    ["API con Hono en Cloudflare Workers", "api-hono"],
    ["Extensión de Chrome que resume la página", "chrome-extension"],
  ])("%s → %s", (description, kit) => {
    expect(recommend(description).kit).toBe(kit);
  });

  it("picks the libraries the description asks for", () => {
    const r = recommend("Una landing para lanzar mi app, con animaciones y analítica");
    expect(r.options.animation).toContain("motion");
    expect(r.options.observability).toEqual(expect.arrayContaining(["vercel-analytics"]));
  });

  it("adds what a choice requires (Better Auth needs Drizzle)", () => {
    const r = recommend("SaaS con login de usuarios y pagos");
    expect(r.options.auth).toEqual(["better-auth"]);
    expect(r.options.database).toEqual(["drizzle-postgres"]);
    expect(r.options.payments).toEqual(["stripe"]);
  });

  it("always returns a valid combination, whatever the text", () => {
    for (const d of ["", "???", "todo: ia, pagos, email, idiomas, tests, docker, errores, animaciones", "go python vue svelte"]) {
      expect(() => recommend(d)).not.toThrow();
    }
  });

  it("drops unknown options and choices from a model's answer", () => {
    const kit = kits.find((k) => k.name === "saas-next-supabase")!;
    const r = resolveRecommendation(kit, { kit: kit.name, options: { payments: ["polar"], nope: ["x"], email: ["resend"] }, reasons: [] }, "claude");
    expect(r.options.payments).toEqual(["stripe"]);
    expect(r.options.email).toEqual(["resend"]);
    expect(r.options).not.toHaveProperty("nope");
  });
});

// 30 descriptions with the kit a person would pick. Keep it at ≥25/30; if a change
// lowers it, look at the misses printed below. With ANTHROPIC_API_KEY, the same set
// reviews the Claude recommender (see docs/roadmap/06-nativo-para-agentes.md).
describe("recommendation quality", () => {
  const cases = JSON.parse(readFileSync(join(__dirname, "recommend.eval.json"), "utf8")) as [string, string][];
  it("picks the expected kit for at least 25 of 30 descriptions", () => {
    const misses = cases.filter(([d, kit]) => recommend(d).kit !== kit).map(([d, kit]) => `${d} → ${recommend(d).kit} (esperado ${kit})`);
    if (misses.length) console.log(`Fallos (${misses.length}/${cases.length}):\n${misses.join("\n")}`);
    expect(cases.length).toBe(30);
    expect(cases.length - misses.length).toBeGreaterThanOrEqual(25);
  });
});
