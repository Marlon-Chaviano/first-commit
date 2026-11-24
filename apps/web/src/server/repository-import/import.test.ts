import { unzipSync, strFromU8 } from "fflate";
import { afterEach, describe, expect, it, vi } from "vitest";
import { importRepositoryBrand } from "./brand";
import { repositoryReader, type Snapshot } from "./github";
import { detectRepositoryKit, prepareRepositoryKit } from "./kit";

const commit = "a".repeat(40);
const source = { repo: "studio/product", commit, folder: "apps/web" };
function snapshot(files: Record<string, string>): Snapshot {
  return {
    paths: Object.keys(files),
    inheritedLocks: ["pnpm-lock.yaml"],
    partial: false,
    readable: (path) => path in files,
    read: async (path) => Buffer.from(files[path]!),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("public GitHub reader", () => {
  it("paginates public repositories and keeps their actual default branch", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json([{ full_name: "studio/one", visibility: "public", default_branch: "develop" }, { visibility: "private" }], {
          headers: { link: '<next>; rel="next"' },
        }),
      )
      .mockResolvedValueOnce(Response.json([{ full_name: "studio/two", visibility: "public", default_branch: "release" }]));
    vi.stubGlobal("fetch", fetcher);
    const reader = repositoryReader("fixture");
    expect(await reader.repositories(1)).toEqual({ repos: [{ name: "studio/one", branch: "develop" }], more: true });
    expect((await reader.repositories(2)).more).toBe(false);
    expect(fetcher.mock.calls[1]![0]).toContain("page=2");
  });

  it("resolves a branch once and reads regular files in the selected subtree at that commit", async () => {
    const entry = (path: string, type: string, sha: string, mode = "100644") => ({ path, type, sha, mode, size: 3 });
    const fetcher = vi.fn(async (url: string) => {
      const path = new URL(url).pathname.replace("/repos/studio/product", "");
      if (!path) return Response.json({ visibility: "public" });
      if (path === "/commits/develop") return new Response(commit);
      if (path.endsWith(commit))
        return Response.json({
          tree: url.includes("?")
            ? [entry("apps/web/package.json", "blob", "pkg")]
            : [entry("apps", "tree", "apps"), entry("pnpm-lock.yaml", "blob", "lock")],
          truncated: false,
        });
      if (path.endsWith("/apps")) return Response.json({ tree: [entry("web", "tree", "web")] });
      if (path.endsWith("/web"))
        return Response.json({
          tree: [
            entry("package.json", "blob", "pkg"),
            entry("logo.svg", "blob", "link", "120000"),
            entry(".env", "blob", "env"),
            entry("vendor", "commit", "sub", "160000"),
          ],
          truncated: true,
        });
      if (path === "/git/blobs/pkg") return new Response("abc");
      throw Error("Unexpected request");
    });
    vi.stubGlobal("fetch", fetcher);
    const reader = repositoryReader("fixture");
    expect(await reader.locate(source.repo, "develop")).toEqual({ commit, folders: ["apps/web"], partial: false });
    const pinned = await reader.snapshot(source);
    expect(pinned).toMatchObject({ paths: ["package.json"], inheritedLocks: ["pnpm-lock.yaml"], partial: true });
    expect((await pinned.read("package.json")).toString()).toBe("abc");
    await expect(pinned.read(".env")).rejects.toThrow();
    expect(fetcher.mock.calls.filter(([u]) => u.includes("/commits/"))).toHaveLength(1);
  });

  it("checks visibility again on each read and refuses revoked access", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ visibility: "private" }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetcher);
    const reader = repositoryReader("fixture");
    await expect(reader.snapshot(source)).rejects.toThrow(/public/);
    await expect(reader.branches(source.repo)).rejects.toThrow(/Reconnect/);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe("review and export", () => {
  it("embeds safe logos and shows alternate palettes with their source paths", async () => {
    const project = snapshot({
      "globals.css": ":root { --primary: #cc3344; --font-sans: Inter; }",
      "theme.css": ":root { --primary: #1144bb; }",
      "public/logo.svg": '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
      "public/icon.png": "invalid",
    });
    const { detection, partial } = await importRepositoryBrand(project, "Web");
    expect(detection.profile.colors.primary).toBe("#cc3344");
    expect(detection.profile.assets?.logo).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(detection.candidates?.primary).toContainEqual({ value: "#1144bb", source: "theme.css" });
    expect(detection.profile.assets?.icon).toBeUndefined();
    expect(partial).toBe(true);
    await expect(importRepositoryBrand(snapshot({}), "Web")).rejects.toThrow(/No brand/);
  });

  it("exports the reviewed manifest and only selected files in a portable ZIP", async () => {
    const project = snapshot({
      "package.json": JSON.stringify({ name: "@studio/web", dependencies: { react: "19", next: "16", zod: "4", shared: "workspace:*" } }),
      ".mcp.json": JSON.stringify({ mcpServers: { custom: { command: "local", env: { TOKEN: "fixture-value" } } } }),
      "src/lib/helper.ts": "export const answer = 42;",
      "src/lib/other.ts": "",
      "src/lib/credentials.ts": "",
      "AGENTS.md": "Review carefully.",
    });
    const { review } = await detectRepositoryKit(project, source, []);
    expect(review).toMatchObject({ name: "web", framework: "Next.js", pm: "pnpm", dependencies: ["zod"], omitted: ["shared", "custom"] });
    expect(review.files).not.toContain("src/lib/credentials.ts");
    const choices = { ...review, title: "Web starter", files: ["src/lib/helper.ts"], instructions: false };
    const { zip, content, plan } = await prepareRepositoryKit(project, source, [], choices);
    const files = unzipSync(Buffer.from(zip, "base64"));
    expect(Object.keys(files)).toEqual(["kit/kit.json", "kit/files/src/lib/helper.ts"]);
    expect(strFromU8(files["kit/kit.json"]!)).toBe(content);
    expect(JSON.parse(content)).toMatchObject({ title: "Web starter", files: "files", dependencies: ["zod"] });
    expect(content).not.toMatch(/fixture-value|Review carefully/);
    expect(plan.join(" ")).toMatch(/create-next-app/);
    await expect(prepareRepositoryKit(project, source, [], { ...choices, files: ["src/lib/credentials.ts"] })).rejects.toThrow(/selection/);
  });
});
