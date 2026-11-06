import { describe, expect, it } from "vitest";

import { defaultSelections } from "./resolve";
import { parseKit } from "./schema";
import { requirementText, selectionsFrom } from "./selections";

// Better Auth needs Drizzle; the AI library needs React (a framework that can't be auto-selected here).
const kit = parseKit({
  name: "saas",
  version: "1.0.0",
  title: "SaaS",
  description: "",
  category: "saas",
  author: "a",
  base: { command: "mkdir {{name}}" },
  options: [
    { id: "framework", label: "Framework", default: "react", choices: [{ id: "react", label: "React" }, { id: "vue", label: "Vue" }] },
    { id: "database", label: "Base de datos", default: "none", choices: [{ id: "none", label: "Ninguna" }, { id: "drizzle", label: "Drizzle" }] },
    {
      id: "auth",
      label: "Auth",
      default: "none",
      choices: [
        { id: "none", label: "Ninguna" },
        { id: "better-auth", label: "Better Auth", requires: { database: ["drizzle"] } },
      ],
    },
    { id: "ai", label: "IA", type: "multi", default: [], choices: [{ id: "ai-sdk", label: "AI SDK", requires: { framework: ["react"] } }] },
  ],
});

describe("selectionsFrom", () => {
  it("starts from the kit's defaults", () => {
    expect(selectionsFrom(kit, {}).selections).toEqual(defaultSelections(kit));
  });

  it("autofill: selects what a requested choice needs and reports it", () => {
    const { selections, added } = selectionsFrom(kit, { options: { auth: ["better-auth"] } }, { requirements: "autofill" });
    expect(selections.options.database).toEqual(["drizzle"]);
    expect(added).toEqual([{ optionId: "database", choiceId: "drizzle", label: "Drizzle" }]);
  });

  it("autofill: deselecting a requirement drops what needed it instead of re-adding it", () => {
    const base = selectionsFrom(kit, { options: { auth: ["better-auth"] } }, { requirements: "autofill" }).selections;
    const { selections, added } = selectionsFrom(kit, { base, options: { database: ["none"] } }, { requirements: "autofill" });
    expect(added).toEqual([]);
    expect(selections.options.database).toEqual(["none"]);
    expect(selections.options.auth).toEqual(["none"]);
  });

  it("throw: names the missing requirement", () => {
    expect(() => selectionsFrom(kit, { options: { auth: ["better-auth"] } }, { requirements: "throw" })).toThrow(/database=drizzle/);
    expect(() => selectionsFrom(kit, { options: { auth: ["better-auth"], database: ["drizzle"] } }, { requirements: "throw" })).not.toThrow();
  });

  it("prune: drops a requested choice whose requirement is missing and reports it", () => {
    const { selections, dropped } = selectionsFrom(kit, { options: { framework: ["vue"], ai: ["ai-sdk"] } }, { requirements: "prune" });
    expect(selections.options.ai).toEqual([]);
    expect(dropped).toEqual([{ optionId: "ai", choiceId: "ai-sdk" }]);
  });

  it("unknown options and values: an error, or skipped with unknown: ignore", () => {
    expect(() => selectionsFrom(kit, { options: { nope: ["x"] } })).toThrow(/has no "nope" option/);
    expect(() => selectionsFrom(kit, { options: { auth: ["clerk"] } })).toThrow(/isn't a value of auth/);
    const { selections } = selectionsFrom(kit, { options: { nope: ["x"], auth: ["clerk", "better-auth", "none"] } }, { requirements: "autofill", unknown: "ignore" });
    expect(selections.options.auth).toEqual(["better-auth"]);
    expect(selections).not.toHaveProperty("options.nope");
  });

  it("keeps the base's agents and package manager unless the request sets them", () => {
    const { selections } = selectionsFrom(kit, { agents: ["cursor"] });
    expect(selections.agents).toEqual(["cursor"]);
    expect(() => selectionsFrom(kit, { pm: "go" })).toThrow(/supports/);
  });
});

describe("requirementText", () => {
  it("names the choices a choice needs by their labels", () => {
    const betterAuth = kit.options.find((o) => o.id === "auth")!.choices[1]!;
    expect(requirementText(kit, betterAuth)).toBe("Requires Drizzle");
  });
});
