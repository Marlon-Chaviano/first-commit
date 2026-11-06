import { describe, expect, it } from "vitest";

import { LANGUAGE_IDS } from "./languages";
import { nodeRunner, PACKAGE_MANAGER_IDS, packageManager, pmFromLockfiles, pmFromUserAgent } from "./package-managers";

describe("package manager profiles", () => {
  it.each(PACKAGE_MANAGER_IDS)("%s has a complete profile", (pm) => {
    const profile = packageManager(pm);
    expect(LANGUAGE_IDS).toContain(profile.language);
    expect(profile.exec).not.toBe("");
    expect(profile.add.deps).toContain("{{packages}}");
    expect(profile.add.dev).toContain("{{packages}}");
  });

  it("runs Node CLIs with the manager's own runner only for JavaScript managers", () => {
    expect(nodeRunner("pnpm")).toBe("pnpm dlx");
    expect(nodeRunner("bun")).toBe("bunx");
    expect(nodeRunner("deno")).toBe("npx");
    expect(nodeRunner("uv")).toBe("npx");
  });

  it("detects the manager from the user agent and from lockfiles", () => {
    expect(pmFromUserAgent("pnpm/10.27.0 npm/? node/v25")).toBe("pnpm");
    expect(pmFromUserAgent("npm/11.6.2 node/v25")).toBeUndefined();
    expect(pmFromLockfiles((f) => f === "bun.lockb")).toBe("bun");
    expect(pmFromLockfiles(() => false)).toBe("npm");
  });
});
