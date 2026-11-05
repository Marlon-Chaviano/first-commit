import { BRAND } from "@kits/schema";
import { describe, expect, it } from "vitest";

import { canVerify } from "./authorize";

describe("canVerify", () => {
  it("official kits only from the registry repository", () => {
    expect(canVerify("mobile-expo", BRAND.repo)).toBe(true);
    expect(canVerify("mobile-expo", "someone/fork")).toBe(false);
  });

  it("community kits only from their own repository", () => {
    expect(canVerify("Ana/kits/kit", "ana/kits")).toBe(true);
    expect(canVerify("ana/kits", "ana/kits")).toBe(true);
    expect(canVerify("ana/kits/kit", "mallory/kits")).toBe(false);
    expect(canVerify("ana/kits-evil/kit", "ana/kits")).toBe(false);
  });
});
