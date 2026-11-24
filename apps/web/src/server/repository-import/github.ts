import "server-only";

import { BRAND } from "@kits/schema/light";
import { fail } from "../errors";

interface Entry {
  path: string;
  type: string;
  mode: string;
  sha: string;
  size?: number;
}
interface Tree {
  tree: Entry[];
  truncated: boolean;
}
export interface Repository {
  name: string;
  branch: string;
}
export interface Source {
  repo: string;
  commit: string;
  folder: string;
}

const SHA = /^[0-9a-f]{40}$/;
const excluded = /(?:^|\/)(?:\.[^/]+|node_modules|dist|build|coverage|vendor)(?:\/|$)/;
const regular = (entry: Entry) => entry.type === "blob" && ["100644", "100755"].includes(entry.mode);
const lockfiles = ["pnpm-lock.yaml", "bun.lock", "bun.lockb", "package-lock.json", "yarn.lock"];
const maxFile = 200_000;

export function repositoryReader(token: string) {
  const signal = AbortSignal.timeout(22_000);
  async function request(path: string, accept = "application/vnd.github+json") {
    const response = await fetch("https://api.github.com" + path, {
      headers: { authorization: "Bearer " + token, accept, "user-agent": BRAND.name },
      cache: "no-store",
      redirect: "error",
      signal,
    }).catch(() => fail("GitHub did not respond in time. Try again or choose a smaller project folder."));
    if (response.ok) return response;
    await response.body?.cancel();
    if (response.status === 401) fail("Reconnect GitHub in account settings and try again.");
    if (response.status === 409) fail("This repository is empty. Choose one with a commit.");
    if (response.status === 403 || response.status === 429) fail("GitHub limited access. Check your connection or try again later.");
    if (response.status === 404 || response.status === 422)
      fail("GitHub couldn't find this repository or branch. Check the selection and try again.");
    return fail("GitHub is unavailable. Try again in a moment.");
  }

  async function publicRepo(repo: string) {
    if (!/^[\w-]+\/[\w.-]+$/.test(repo) || /^\.+$/.test(repo.split("/")[1]!)) fail("Choose a GitHub repository.");
    const path = "/repos/" + repo;
    const info = await (await request(path)).json();
    if (info.visibility !== "public") fail("Choose a public repository.");
    return path;
  }

  async function tree(path: string, sha: string, recursive = false): Promise<Tree> {
    return (await request(path + "/git/trees/" + sha + (recursive ? "?recursive=1" : ""))).json();
  }

  return {
    async repositories(page: number) {
      if (!Number.isSafeInteger(page) || page < 1 || page > 10000) fail("Invalid page.");
      const response = await request("/user/repos?visibility=public&sort=pushed&per_page=50&page=" + page);
      const rows = (await response.json()) as { full_name: string; default_branch: string; visibility: string }[];
      return {
        repos: rows.filter((r) => r.visibility === "public").map((r) => ({ name: r.full_name, branch: r.default_branch })),
        more: Boolean(response.headers.get("link")?.includes('rel="next"')),
      };
    },
    async branches(repo: string) {
      const path = await publicRepo(repo);
      const rows = (await (await request(path + "/branches?per_page=100")).json()) as { name: string }[];
      if (!rows.length) fail("This repository is empty. Choose one with a commit.");
      return rows.map((r) => r.name);
    },
    async locate(repo: string, branch: string) {
      if (!branch || branch.length > 255 || branch.split("/").some((s) => !s || s === "." || s === "..")) fail("Choose a branch.");
      const path = await publicRepo(repo);
      const result = await (await request(path + "/commits/" + encodeURIComponent(branch), "application/vnd.github.sha")).text();
      const commit = result.trim();
      if (!SHA.test(commit)) fail("GitHub couldn't resolve this branch. Try again.");
      const listing = await tree(path, commit, true);
      const projects = listing.tree
        .filter((e) => regular(e) && /(^|\/)package\.json$/.test(e.path) && !excluded.test(e.path))
        .map((e) => e.path.split("/").slice(0, -1).join("/"))
        .filter(Boolean);
      return { commit, folders: projects.slice(0, 100), partial: listing.truncated || projects.length > 100 };
    },
    async snapshot({ repo, commit, folder }: Source) {
      if (!SHA.test(commit)) fail("Select the branch again.");
      const parts = folder ? folder.split("/") : [];
      if (folder.length > 500 || parts.length > 12 || parts.some((p) => !p || excluded.test(p) || /[\\\x00-\x1f]/.test(p)))
        fail("Enter a project folder relative to the repository.");
      const path = await publicRepo(repo);
      let sha = commit;
      let inheritedLocks: string[] = [];
      for (const part of parts) {
        const parent = await tree(path, sha);
        const locks = parent.tree.filter((e) => regular(e) && lockfiles.includes(e.path)).map((e) => e.path);
        if (locks.length) inheritedLocks = locks;
        const child = parent.tree.find((e) => e.type === "tree" && e.path === part);
        if (!child) fail("Folder not found. Check the path or choose another folder.");
        sha = child.sha;
      }
      const listing = await tree(path, sha, true);
      const entries = listing.tree.filter(
        (e) => regular(e) && (!excluded.test(e.path) || e.path === ".mcp.json" || e.path === ".cursor/mcp.json"),
      );
      const byPath = new Map(entries.map((e) => [e.path, e]));
      let filesRead = 0;
      let bytesRead = 0;
      return {
        paths: [...byPath.keys()],
        inheritedLocks,
        partial: listing.truncated,
        readable(file: string) {
          return (byPath.get(file)?.size ?? Infinity) <= maxFile;
        },
        async read(file: string) {
          const entry = byPath.get(file);
          if (!entry || entry.size === undefined || entry.size > maxFile) fail("This file is too large to import: " + file);
          bytesRead += entry.size;
          if (++filesRead > 20 || bytesRead > 1_600_000) fail("Choose a smaller project folder to import.");
          const response = await request(path + "/git/blobs/" + entry.sha, "application/vnd.github.raw+json");
          const buffer = Buffer.from(await response.arrayBuffer());
          if (buffer.length !== entry.size) fail("GitHub returned an incomplete file. Try again.");
          return buffer;
        },
      };
    },
  };
}

export type Snapshot = Awaited<ReturnType<ReturnType<typeof repositoryReader>["snapshot"]>>;
