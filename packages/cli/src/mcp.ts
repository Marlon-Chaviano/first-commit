import { spawn } from "node:child_process";
import { resolve } from "node:path";

import { createKitsServer, type KitsSource } from "@kits/mcp";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import {
  BRAND,
  recommendationSchema,
  recommendHeuristic,
  resolveRecommendation,
  type Kit,
  type Recommendation,
  type ResolvedRecommendation,
} from "@kits/schema";

import type { ParsedArgs } from "./args";
import { api } from "./api";
import { loadCatalog, loadIndex, loadKit } from "./registry";

/**
 * `create-first-commit mcp` — MCP server over stdio for Claude Code, Cursor, Codex…
 * stdout is the protocol: nothing else may print to it.
 */
export async function mcp(args: ParsedArgs, version: string): Promise<void> {
  const cwd = resolve(args.flags.get("dir")?.[0] ?? process.cwd());
  const kits = new Map<string, Promise<Kit>>();
  const kit = (ref: string) => {
    if (!kits.has(ref)) kits.set(ref, loadKit(ref).then((l) => l.kit));
    const pending = kits.get(ref)!;
    pending.catch(() => kits.delete(ref));
    return pending;
  };

  const source: KitsSource = {
    entries: loadIndex,
    kit,
    catalog: loadCatalog,
    recommend: async (description) => {
      const remote = await recommendRemote(description);
      if (remote) {
        try {
          return resolveRecommendation(await kit(remote.kit), remote, remote.source);
        } catch {
          // A remote answer that doesn't validate against this registry: fall back.
        }
      }
      const all = await Promise.all((await loadIndex()).map((e) => kit(e.name)));
      const rec = recommendHeuristic(description, all);
      return resolveRecommendation(all.find((k) => k.name === rec.kit)!, rec, "heuristic");
    },
  };

  serveStdio(() => createKitsServer({ source, version, cwd, local: { init: (a, dir) => runSelf(a, dir), add: (piece, dir) => runSelf(["add", piece, "--yes"], dir) } }), {
    onerror: (error) => process.stderr.write(`[${BRAND.cli} mcp] ${error.message}\n`),
  });
}

/** The website's recommender (Claude, when configured there). Null when it can't be reached. */
async function recommendRemote(description: string): Promise<(Recommendation & { source: ResolvedRecommendation["source"] }) | null> {
  if (process.env.KITS_OFFLINE) return null;
  try {
    const res = await api<{ source?: string }>("/api/v1/recommend", { method: "POST", auth: "none", body: { description }, timeoutMs: 20_000 });
    if (!res.ok) return null;
    const body = res.data;
    const rec = recommendationSchema.parse(body);
    return { ...rec, source: body.source === "claude" ? "claude" : "heuristic" };
  } catch {
    return null;
  }
}

/** Runs this same CLI (non-interactive: no TTY) and returns its output without colors. */
function runSelf(args: string[], cwd: string): Promise<string> {
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, [process.argv[1]!, ...args], {
      cwd,
      env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0", KITS_NO_UPDATE_NOTICE: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (d: Buffer) => (output += d.toString()));
    child.stderr.on("data", (d: Buffer) => (output += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      // eslint-disable-next-line no-control-regex
      const clean = output.replace(/\u001b\[[0-9;]*m/g, "").trim();
      const tail = clean.split("\n").slice(-60).join("\n");
      if (code === 0) done(tail);
      else reject(new Error(`${BRAND.cli} ${args[0]} exited with code ${code}:\n${tail}`));
    });
  });
}
