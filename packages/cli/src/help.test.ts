import { describe, expect, it } from "vitest";

import { cleanHint } from "./exec";
import { closest, commandHelp } from "./help";

describe("closest", () => {
  const kits = ["saas-next-supabase", "landing-next", "mobile-expo", "api-hono"];
  it("suggests the kit that was meant", () => {
    expect(closest("saas-nxt-supabase", kits)).toEqual(["saas-next-supabase"]);
    expect(closest("expo", kits)).toEqual(["mobile-expo"]);
  });
  it("suggests nothing for something unrelated", () => {
    expect(closest("kubernetes", kits)).toEqual([]);
  });
});

describe("cleanHint", () => {
  it("drops other tools' spinners and bullets", () => {
    expect(cleanHint("◐  Cloning repository…")).toBe("Cloning repository…");
    expect(cleanHint("│  ●  Agent   detected")).toBe("Agent detected");
  });
});

describe("commandHelp", () => {
  it("documents the options of commands that have their own", () => {
    expect(commandHelp("test")).toContain("--only-defaults");
    expect(commandHelp("login")).toContain("--token");
    expect(commandHelp("list")).toBeNull();
  });
});
