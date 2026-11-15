import { describe, expect, it } from "vitest";
import { resolve } from "./resolve";
import { parseKit } from "./schema";
import { testCombinations } from "./verify";

describe("verification combinations", () => {
  it("excludes both kit skills and the automatically injected product skill", () => {
    const kit = parseKit({ name: "demo", version: "1.0.0", title: "Demo", description: "", category: "web", author: "a", base: { command: "mkdir {{name}}" }, skills: ["owner/skills@base"], options: [{ id: "tools", label: "Tools", type: "multi", default: [], choices: [{ id: "review", label: "Review", skills: ["owner/skills@review"] }] }] });
    const combinations = testCombinations(kit);
    expect(combinations).toHaveLength(2);
    for (const combo of combinations) expect(resolve(kit, combo.sel).skills).toEqual([]);
  });
});
