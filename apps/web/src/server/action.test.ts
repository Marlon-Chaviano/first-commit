import { beforeEach, describe, expect, it, vi } from "vitest";

const viewer = { current: null as null | { id: string; handle: string; role: string; name: string } };
const revalidated: string[] = [];

vi.mock("./session", () => ({ getViewer: async () => viewer.current, isAdmin: (u: { role?: string } | null) => u?.role === "admin" }));
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidated.push(`path:${p}`), revalidateTag: (t: string) => revalidated.push(`tag:${t}`) }));
vi.mock("next/navigation", () => ({
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
  },
}));

import { z } from "zod";

import { action } from "./action";
import { DomainError, fail } from "./errors";
import { OrgError } from "./orgs";

const me = { id: "u1", handle: "ana", role: "user", name: "Ana" };

describe("action", () => {
  beforeEach(() => {
    viewer.current = me;
    revalidated.length = 0;
  });

  it("asks to log in, or for an admin, before running the body", async () => {
    viewer.current = null;
    const body = vi.fn(async () => 1);
    expect(await action({}, body)).toEqual({ ok: false, error: "Log in first" });
    viewer.current = me;
    expect(await action({ auth: "admin" }, body)).toEqual({ ok: false, error: "You don't have permission" });
    expect(body).not.toHaveBeenCalled();
    viewer.current = null;
    expect(await action({ auth: "optional" }, async (v) => v)).toEqual({ ok: true, data: null });
  });

  it("returns the data and refreshes what changed, only on success", async () => {
    expect(await action({ revalidate: { paths: ["/a", ["/b", "layout"]], tags: ["t"] } }, async (v) => v.handle)).toEqual({ ok: true, data: "ana" });
    expect(revalidated).toEqual(["path:/a", "path:/b", "tag:t"]);
    revalidated.length = 0;
    await action({ revalidate: { paths: ["/a"] } }, async () => fail("nope"));
    expect(revalidated).toEqual([]);
  });

  it("shows domain and validation errors, hides bugs, lets redirects through", async () => {
    expect(await action({}, async () => fail("Type acme to confirm"))).toEqual({ ok: false, error: "Type acme to confirm" });
    expect(await action({}, async () => Promise.reject(new OrgError(403, "Only an owner can add owners")))).toEqual({ ok: false, error: "Only an owner can add owners" });
    expect(new OrgError(403, "x")).toBeInstanceOf(DomainError);
    expect(await action({}, async () => z.string().min(3, "Too short").parse("a"))).toEqual({ ok: false, error: "Too short" });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await action({ failure: "Couldn't save" }, async () => Promise.reject(new Error("db down")))).toEqual({ ok: false, error: "Couldn't save" });
    expect(log).toHaveBeenCalled();
    await expect(action({}, async () => Promise.reject(new Error("NEXT_REDIRECT")))).rejects.toThrow("NEXT_REDIRECT");
  });
});
