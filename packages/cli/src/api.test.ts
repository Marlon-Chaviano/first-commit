import { afterEach, describe, expect, it } from "vitest";

import { api, useFetch } from "./api";

const calls: { url: string; init: RequestInit }[] = [];
let restore = () => {};
const answer = (response: Response | Error) =>
  (restore = useFetch((async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    if (response instanceof Error) throw response;
    return response;
  }) as typeof fetch));

describe("api", () => {
  afterEach(() => {
    restore();
    calls.length = 0;
    delete process.env.KITS_TOKEN;
    delete process.env.KITS_API_URL;
  });

  it("sends the base URL, the token, JSON and the user agent", async () => {
    process.env.KITS_API_URL = "http://registry.test";
    process.env.KITS_TOKEN = "kits_secret";
    answer(Response.json({ handle: "ana" }));
    expect(await api("/api/v1/me", { method: "POST", body: { a: 1 } })).toEqual({ ok: true, status: 200, data: { handle: "ana" } });
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(calls[0]!.url).toBe("http://registry.test/api/v1/me");
    expect(headers.authorization).toBe("Bearer kits_secret");
    expect(headers["content-type"]).toBe("application/json");
    expect(headers["user-agent"]).toBe("create-first-commit");
    expect(calls[0]!.init.body).toBe('{"a":1}');
  });

  it("sends no credentials with auth: none", async () => {
    process.env.KITS_TOKEN = "kits_secret";
    answer(Response.json({}));
    await api("/api/v1/events", { auth: "none" });
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it("never throws: errors carry the status and the server's message", async () => {
    answer(Response.json({ error: "Kit not found", buyUrl: "x" }, { status: 402 }));
    expect(await api("/api/v1/kits/a/b")).toEqual({ ok: false, status: 402, error: "Kit not found", body: { error: "Kit not found", buyUrl: "x" } });
    restore();
    answer(new Error("ECONNREFUSED"));
    const down = await api("/api/v1/me");
    expect(down).toMatchObject({ ok: false, status: 0 });
    expect(!down.ok && down.error).toMatch(/Couldn't reach .*ECONNREFUSED/);
  });

  it("reads archives as bytes and an empty 204", async () => {
    answer(new Response(new Uint8Array([1, 2, 3])));
    const archive = await api<Buffer>("/a", { as: "buffer" });
    expect(archive.ok && [...archive.data]).toEqual([1, 2, 3]);
    restore();
    answer(new Response(null, { status: 204 }));
    expect(await api("/b", { method: "DELETE" })).toEqual({ ok: true, status: 204, data: undefined });
  });
});
