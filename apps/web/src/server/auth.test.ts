import { describe, expect, it, vi } from "vitest";

// auth.ts creates the Better Auth instance at import time; only the pure helper is under test.
vi.mock("./db", () => ({ db: null }));

const { toHandle } = await import("./auth");

describe("toHandle", () => {
  it.each([
    ["ana@kits.local", "ana"],
    ["Ana García", "ana-garcia"],
    ["dev.ops+test@example.com", "dev-ops-test"],
    ["@@@", "user"],
  ])("%s → %s", (input, expected) => {
    expect(toHandle(input)).toBe(expected);
  });
});
