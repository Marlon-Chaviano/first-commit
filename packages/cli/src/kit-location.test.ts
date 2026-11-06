import { describe, expect, it } from "vitest";

import { locateKit, needsPublishedLookup, versionMismatch, type PublishedKit } from "./kit-location";

const published: PublishedKit = { version: "1.2.0", repo: "ana/kits", path: "landing", commitSha: "abc123", integrity: "sha256-x" };
const remote = { registry: "gh:acme/first-commit/registry", from: "/work" };

describe("locateKit", () => {
  it("local paths are read in place, relative to the kit that asked", () => {
    expect(locateKit("./mine", { registry: remote.registry, from: "/work/parent" })).toEqual({ name: "./mine", location: { kind: "local", dir: "/work/parent/mine" } });
  });

  it("official kits come from a local registry as they are", () => {
    expect(locateKit("landing-next@1.0.0", { registry: "/repo/registry", from: "/work" }).location).toEqual({ kind: "local-registry", dir: "/repo/registry/kits/landing-next" });
  });

  it("official kits are downloaded at their version tag", () => {
    expect(locateKit("landing-next@1.3.0", remote)).toEqual({
      name: "landing-next",
      version: "1.3.0",
      location: { kind: "official", source: "gh:acme/first-commit/registry/kits/landing-next#landing-next@1.3.0" },
    });
    expect(locateKit("landing-next", remote).location).toEqual({ kind: "official", source: "gh:acme/first-commit/registry/kits/landing-next" });
  });

  it("published community kits are fetched at the published commit and keep the hash to check", () => {
    expect(locateKit("ana/landing", { ...remote, published }).location).toEqual({ kind: "published", source: "gh:ana/kits/landing#abc123", published });
  });

  it("private kits come from the registry archive", () => {
    expect(locateKit("acme/internal", { ...remote, published: { ...published, archive: true } }).location).toMatchObject({ kind: "private", slug: "acme/internal" });
  });

  it("unpublished GitHub paths are fetched at the requested git ref", () => {
    expect(locateKit("ana/repo/kit@v2", remote).location).toEqual({ kind: "github", source: "gh:ana/repo/kit#v2" });
  });
});

describe("needsPublishedLookup", () => {
  it.each([["ana/landing", true], ["ana/landing@1.0.0", true], ["landing-next", false], ["ana/repo/kit", false], ["./kit", false]])("%s → %s", (ref, expected) => {
    expect(needsPublishedLookup(ref)).toBe(expected);
  });
});

describe("versionMismatch", () => {
  it("accepts a v prefix and reports a different version", () => {
    expect(versionMismatch("k", "v1.0.0", "1.0.0")).toBeNull();
    expect(versionMismatch("k", undefined, "1.0.0")).toBeNull();
    expect(versionMismatch("k", "1.1.0", "1.0.0")).toMatch(/k@1.1.0/);
  });
});
