import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Catalog } from "@kits/schema";
import { describe, expect, it } from "vitest";

import { detectProject } from "./detect";

const catalog = [
  { id: "shadcn", name: "shadcn/ui", kind: "components", frameworks: ["react"] },
  { id: "kokonutui", name: "Kokonut UI", kind: "addon", frameworks: ["react"], requires: { components: ["shadcn"] } },
  { id: "motion", name: "Motion", kind: "animation", frameworks: ["react"], dependencies: ["motion"] },
  {
    id: "sentry-nextjs", name: "Sentry", kind: "observability", frameworks: ["nextjs"], dependencies: ["@sentry/nextjs"],
    writeFiles: [{ path: "src/instrumentation.ts", content: "", mode: "create" }],
  },
  { id: "posthog-nextjs", name: "PostHog", kind: "observability", frameworks: ["nextjs"], dependencies: ["posthog-js", "posthog-node"] },
].map((l) => ({
  url: "https://example.com", description: "", usage: "", dependencies: [], devDependencies: [], skills: [], mcp: {}, env: {},
  postInstall: [], writeFiles: [], setupTasks: [], ...l,
})) as Catalog;

function project(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "kits-detect-"));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  return dir;
}

describe("detectProject", () => {
  const dir = project({
    "package.json": JSON.stringify({
      name: "@acme/web",
      dependencies: { next: "16", react: "19", "react-dom": "19", motion: "14", "@sentry/nextjs": "11", "posthog-js": "1", zod: "4", "lucide-react": "1" },
      devDependencies: { typescript: "5", "@types/react": "19", vitest: "5" },
    }),
    "pnpm-lock.yaml": "",
    "components.json": "{}",
    "src/components/kokonutui/search.tsx": "",
    "src/lib/utils.ts": "",
    "src/instrumentation.ts": "",
    "biome.json": "{}",
    "skills-lock.json": JSON.stringify({ version: 1, skills: { "frontend-design": { source: "anthropics/skills" } } }),
    ".claude/skills/frontend-design/SKILL.md": "",
    ".claude/skills/mystery/SKILL.md": "",
    ".mcp.json": JSON.stringify({ mcpServers: { supabase: { type: "http", url: "https://mcp.supabase.com/mcp" } } }),
    "AGENTS.md": "# App\n\n<!-- BEGIN:nextjs-agent-rules -->\nnext\n<!-- END:nextjs-agent-rules -->\n\n## Reglas\n\nUsa zod.\n\n<!-- kits:start -->\nkit\n<!-- kits:end -->\n",
    ".env.example": "API_URL=https://api.example.com\nSECRET=\n",
    ".env": "SECRET=real-secret\n",
  });

  it("recognizes the framework, package manager and catalog libraries", async () => {
    const d = await detectProject(dir, catalog);
    expect(d.framework.id).toBe("nextjs");
    expect(d.pm).toBe("pnpm");
    expect(d.libraries.components?.id).toBe("shadcn");
    expect(d.libraries.addons.map((l) => l.id)).toEqual(["kokonutui"]);
    expect(d.libraries.animation.map((l) => l.id)).toEqual(["motion"]);
    // PostHog needs posthog-node too, so only Sentry matches.
    expect(d.libraries.observability.map((l) => l.id)).toEqual(["sentry-nextjs"]);
  });

  it("keeps only the project's own dependencies", async () => {
    const d = await detectProject(dir, catalog);
    expect(d.dependencies).toEqual(["posthog-js", "zod"]);
    expect(d.devDependencies).toEqual(["vitest"]);
  });

  it("reads skills, MCP, instructions and env without secrets", async () => {
    const d = await detectProject(dir, catalog);
    expect(d.skills).toEqual(["anthropics/skills@frontend-design"]);
    expect(d.unknownSkills).toEqual(["mystery"]);
    expect(d.mcp).toEqual({ supabase: { url: "https://mcp.supabase.com/mcp" } });
    expect(d.instructions).toBe("## Reglas\n\nUsa zod.");
    expect(d.env).toEqual({ API_URL: "https://api.example.com", SECRET: "" });
  });

  it("offers own files, never generated or secret ones", async () => {
    const paths = (await detectProject(dir, catalog)).fileGroups.map((g) => g.path);
    expect(paths).toContain("biome.json");
    expect(paths).toContain("src/lib");
    expect(paths).not.toContain(".env");
    expect(paths).not.toContain("src/instrumentation.ts");
    expect(paths.some((p) => p.startsWith(".claude"))).toBe(false);
  });

  it("asks for --base when the framework is unknown", async () => {
    const other = project({ "package.json": JSON.stringify({ name: "x", dependencies: { express: "5" } }) });
    await expect(detectProject(other, catalog)).rejects.toThrow(/--base/);
    const d = await detectProject(other, catalog, "npx create-something {{name}}");
    expect(d.framework.base.command).toBe("npx create-something {{name}}");
    expect(d.dependencies).toEqual(["express"]);
  });
});
