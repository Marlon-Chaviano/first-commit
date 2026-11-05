import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { catalogSchema, expandKit } from "./libraries";
import { defaultSelections } from "./resolve";
import { parseKit } from "./schema";
import { changedOptions, stackSelections, stackSlug, stacksSchema } from "./stacks";

const registry = join(__dirname, "../../../registry");
const catalog = catalogSchema.parse(JSON.parse(readFileSync(join(registry, "libraries.json"), "utf8")));
const kit = (name: string) => expandKit(parseKit(JSON.parse(readFileSync(join(registry, "kits", name, "kit.json"), "utf8"))), catalog);

describe("stacks", () => {
  it("every curated stack is a valid combination of an official kit", () => {
    const kits = new Set(readdirSync(join(registry, "kits")));
    for (const stack of stacksSchema.parse(JSON.parse(readFileSync(join(registry, "stacks.json"), "utf8")))) {
      expect(kits.has(stack.kit)).toBe(true);
      expect(() => stackSelections(kit(stack.kit), stack.options)).not.toThrow();
    }
  });

  it("rejects options the kit doesn't have or that requirements would drop", () => {
    const saas = kit("saas-next-supabase");
    expect(() => stackSelections(saas, { nope: ["x"] })).toThrow(/no tiene/);
    expect(() => stackSelections(saas, { auth: ["better-auth"] })).toThrow();
  });

  it("round-trips: changedOptions of a stack's selections is the stack's options", () => {
    const saas = kit("saas-next-supabase");
    const options = { auth: ["better-auth"], database: ["drizzle-postgres"], email: ["resend"] };
    expect(changedOptions(saas, stackSelections(saas, options))).toEqual(options);
    expect(changedOptions(saas, defaultSelections(saas))).toEqual({});
  });

  it("builds deterministic slugs in option order", () => {
    const saas = kit("saas-next-supabase");
    const a = stackSlug(saas, { email: ["resend"], auth: ["better-auth"], database: ["drizzle-postgres"] });
    const b = stackSlug(saas, { database: ["drizzle-postgres"], auth: ["better-auth"], email: ["resend"] });
    expect(a).toBe(b);
    expect(a).toBe("saas-next-supabase-better-auth-drizzle-postgres-resend");
  });
});
