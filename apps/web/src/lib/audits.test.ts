import { describe, expect, it } from "vitest";

import { worstRisk } from "./audits";

describe("worstRisk", () => {
  it("picks the highest risk and ignores unknown values", () => {
    expect(worstRisk(["safe", "medium", "low"])).toBe("medium");
    expect(worstRisk(["Safe", "HIGH"])).toBe("high");
    expect(worstRisk(["pending", "safe"])).toBe("safe");
  });
});
