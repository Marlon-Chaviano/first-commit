import type { McpServer } from "./schema";

/** Turns the existing file content (if any) into the new content. */
export type Merge = (existing: string | undefined) => string;

export interface McpTarget {
  path: string;
  merge: (servers: Record<string, McpServer>) => Merge;
}

const isRemote = (s: McpServer): s is Extract<McpServer, { url: string }> => "url" in s;

function jsonMerge(key: string, convert: (s: McpServer) => unknown): McpTarget["merge"] {
  return (servers) => (existing) => {
    const data = existing ? JSON.parse(existing) : {};
    data[key] = { ...data[key] };
    for (const [name, server] of Object.entries(servers)) data[key][name] ??= convert(server);
    return JSON.stringify(data, null, 2) + "\n";
  };
}

const stdio = (s: Extract<McpServer, { command: string }>) => ({
  command: s.command,
  args: s.args,
  ...(s.env ? { env: s.env } : {}),
});

/**
 * Project-level MCP config per agent. Agents missing here (e.g. Windsurf) only
 * support user-level MCP config, so the kit lists the servers in AGENTS.md instead.
 */
export const MCP_TARGETS: Record<string, McpTarget> = {
  "claude-code": {
    path: ".mcp.json",
    merge: jsonMerge("mcpServers", (s) =>
      isRemote(s) ? { type: "http", url: s.url, ...(s.headers ? { headers: s.headers } : {}) } : stdio(s),
    ),
  },
  cursor: {
    path: ".cursor/mcp.json",
    merge: jsonMerge("mcpServers", (s) =>
      isRemote(s) ? { url: s.url, ...(s.headers ? { headers: s.headers } : {}) } : stdio(s),
    ),
  },
  "gemini-cli": {
    path: ".gemini/settings.json",
    merge: jsonMerge("mcpServers", (s) =>
      isRemote(s) ? { httpUrl: s.url, ...(s.headers ? { headers: s.headers } : {}) } : stdio(s),
    ),
  },
  "github-copilot": {
    path: ".vscode/mcp.json",
    merge: jsonMerge("servers", (s) =>
      isRemote(s)
        ? { type: "http", url: s.url, ...(s.headers ? { headers: s.headers } : {}) }
        : { type: "stdio", ...stdio(s) },
    ),
  },
  opencode: {
    path: "opencode.json",
    merge: jsonMerge("mcp", (s) =>
      isRemote(s)
        ? { type: "remote", url: s.url, ...(s.headers ? { headers: s.headers } : {}) }
        : { type: "local", command: [s.command, ...s.args], ...(s.env ? { environment: s.env } : {}) },
    ),
  },
  codex: {
    path: ".codex/config.toml",
    merge: (servers) => (existing) => {
      let out = existing ?? "";
      for (const [name, s] of Object.entries(servers)) {
        const header = `[mcp_servers.${name}]`;
        if (out.includes(header)) continue;
        const lines = [header];
        if (isRemote(s)) {
          lines.push(`url = ${toml(s.url)}`);
          if (s.headers) lines.push(`http_headers = { ${inlineTable(s.headers)} }`);
        } else {
          lines.push(`command = ${toml(s.command)}`, `args = [${s.args.map(toml).join(", ")}]`);
          if (s.env) lines.push(`env = { ${inlineTable(s.env)} }`);
        }
        out = (out ? out.trimEnd() + "\n\n" : "") + lines.join("\n") + "\n";
      }
      return out;
    },
  },
};

const toml = (v: string) => JSON.stringify(v);
const inlineTable = (o: Record<string, string>) =>
  Object.entries(o).map(([k, v]) => `${JSON.stringify(k)} = ${toml(v)}`).join(", ");

/**
 * Agents that don't read AGENTS.md natively get a stub that imports it, so
 * every agent shares one set of instructions.
 */
export const INSTRUCTION_STUBS: Record<string, string> = {
  "claude-code": "CLAUDE.md",
  "gemini-cli": "GEMINI.md",
};

export const importAgentsMd: Merge = (existing) => {
  if (!existing) return "@AGENTS.md\n";
  if (existing.includes("@AGENTS.md")) return existing;
  return `@AGENTS.md\n\n${existing}`;
};

/**
 * Adds (or replaces) a managed block in AGENTS.md, keeping everything else.
 * `id` "kits" is the kit's own section; `create-first-commit add` uses "kits-add-<library>".
 */
export function upsertBlock(id: string, content: string, title: string): Merge {
  const START = `<!-- ${id}:start -->`;
  const END = `<!-- ${id}:end -->`;
  return (existing) => {
    const block = `${START}\n${content.trim()}\n${END}`;
    if (!existing) return `# ${title}\n\n${block}\n`;
    const start = existing.indexOf(START);
    const end = existing.indexOf(END);
    if (start !== -1 && end !== -1) return existing.slice(0, start) + block + existing.slice(end + END.length);
    return `${existing.trimEnd()}\n\n${block}\n`;
  };
}

/** The kit's section in AGENTS.md, keeping what the scaffolder wrote. */
export function upsertKitSection(section: string, title: string): Merge {
  return upsertBlock("kits", section, title);
}

/** Appends env keys that aren't in the file yet. */
export function mergeEnv(env: Record<string, string>): Merge {
  return (existing) => {
    const present = new Set(
      (existing ?? "").split("\n").map((l) => l.split("=")[0]?.trim()).filter(Boolean),
    );
    const missing = Object.entries(env).filter(([k]) => !present.has(k));
    if (!missing.length) return existing ?? "";
    const prefix = existing ? existing.trimEnd() + "\n" : "";
    return prefix + missing.map(([k, v]) => `${k}=${v}`).join("\n") + "\n";
  };
}
