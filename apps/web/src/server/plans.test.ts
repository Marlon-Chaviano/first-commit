import { describe, expect, it } from "vitest";

import { effectivePlan, planAllows, planOf } from "./plans";

describe("plans", () => {
  it("only Equipos has private kits; Pro and Equipos export CSV", () => {
    expect(planAllows("free", "privateKits")).toBe(false);
    expect(planAllows("pro", "privateKits")).toBe(false);
    expect(planAllows("team", "privateKits")).toBe(true);
    expect(planAllows("pro", "csvExport")).toBe(true);
    expect(planAllows("free", "csvExport")).toBe(false);
  });

  it("unlocks everything while billing is off", () => {
    expect(effectivePlan("free", false)).toBe("team");
    expect(planAllows(effectivePlan(null, false), "privateKits")).toBe(true);
    expect(effectivePlan("free", true)).toBe("free");
  });

  it("treats unknown or missing plans as free", () => {
    expect(planOf(undefined)).toBe("free");
    expect(planOf("enterprise")).toBe("free");
    expect(planAllows("hacker", "privateKits")).toBe(false);
  });
});
