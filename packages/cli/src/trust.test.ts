import { afterEach, describe, expect, it, vi } from "vitest";

import { kitTrust } from "./trust";

afterEach(() => vi.unstubAllGlobals());

describe("kitTrust", () => {
  it("trusts local and official kits without asking the API", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await kitTrust("./mi-kit", "1.0.0")).toBe("local");
    expect(await kitTrust("landing-next@1.0.0", "1.0.0")).toBe("official");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("asks the API for community kits", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ verified: true })));
    vi.stubGlobal("fetch", fetch);
    expect(await kitTrust("ana/kits/web@v1.0.0", "1.0.0")).toBe("verified");
    expect(String(fetch.mock.calls[0]![0])).toContain("kit=ana%2Fkits%2Fweb&version=1.0.0");
  });

  it("treats failures and unknown kits as unverified", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ verified: false }))));
    expect(await kitTrust("ana/kits", "1.0.0")).toBe("unverified");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await kitTrust("ana/kits", "1.0.0")).toBe("unverified");
  });
});
