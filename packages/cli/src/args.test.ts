import { describe, expect, it } from "vitest";

import { parseArgs } from "./args";

describe("parseArgs", () => {
  it("treats every switch documented in --help as valueless, even last", () => {
    const args = parseArgs(["landing-next", "demo", "-y", "--verbose"]);
    expect(args.switches.has("verbose")).toBe(true);
    expect(args.switches.has("yes")).toBe(true);
    expect(args.positionals).toEqual(["demo"]);
    expect(parseArgs(["login", "--no-browser"]).switches.has("no-browser")).toBe(true);
  });

  it("takes a value for kit options", () => {
    expect(parseArgs(["landing-next", "--styling", "tailwind"]).flags.get("styling")).toEqual(["tailwind"]);
    expect(() => parseArgs(["landing-next", "--styling"])).toThrow("needs a value");
  });
});
