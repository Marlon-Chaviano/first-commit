import { describe, expect, it } from "vitest";

import { listDiff } from "./lock";

describe("listDiff", () => {
  it("returns what was added and removed", () => {
    expect(listDiff(["a", "b"], ["b", "c"])).toEqual({ added: ["c"], removed: ["a"] });
  });
});
