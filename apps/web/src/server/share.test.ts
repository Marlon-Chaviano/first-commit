import type { Selections } from "@kits/schema";
import { describe, expect, it } from "vitest";

import { configId } from "./share";

const sel = (over: Partial<Selections> = {}): Selections => ({
  options: { payments: ["stripe"], animation: ["motion", "gsap"] },
  addSkills: [],
  removeSkills: [],
  agents: ["claude-code", "cursor"],
  pm: "pnpm",
  ...over,
});

describe("configId", () => {
  it("is the same for the same configuration, whatever the order", () => {
    const a = configId("landing-next", sel(), "my-app");
    const b = configId("landing-next", sel({ options: { animation: ["gsap", "motion"], payments: ["stripe"] }, agents: ["cursor", "claude-code"] }), "my-app");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-zA-Z]{7}$/);
  });

  it("changes when anything that ends up in the command changes", () => {
    const base = configId("landing-next", sel(), null);
    expect(configId("landing-next", sel({ pm: "npm" }), null)).not.toBe(base);
    expect(configId("landing-next", sel({ badge: false }), null)).not.toBe(base);
    expect(configId("landing-next", sel(), "other")).not.toBe(base);
    expect(configId("landing-astro", sel(), null)).not.toBe(base);
  });
});
