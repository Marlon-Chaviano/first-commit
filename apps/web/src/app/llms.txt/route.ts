import { BRAND, buildInitCommand, cliCommand, defaultSelections } from "@kits/schema";

import { getIndex, getKit } from "@/server/registry";
import { getStacks } from "@/server/stacks";

/** /llms.txt — what an AI agent needs to use kits, in plain markdown (https://llmstxt.org). */
export async function GET() {
  const [entries, stacks] = await Promise.all([getIndex(), getStacks()]);
  const kits = await Promise.all(entries.map(async (e) => ({ entry: e, kit: await getKit(e.name) })));
  const body = `# ${BRAND.name}

> Workspace kits: one command creates a project with its dependencies, agent skills, MCP servers and AGENTS.md rules already set up (\`${cliCommand("<kit>")}\`).

For agents: run \`${cliCommand("<kit> <folder> --dry-run")}\` first and show the plan; then the same command with \`--yes\`. Or use the MCP server: \`npx ${BRAND.cli} mcp\` (local, can create projects) or ${BRAND.siteUrl}/mcp (remote, read-only).

## Docs

- [Use kits from your agent](${BRAND.siteUrl}/docs/agents): MCP server, skill and prompt
- [Create a kit](${BRAND.siteUrl}/docs/create-kit): \`${cliCommand("create")}\` turns a project into a kit
- [kit.json reference](${BRAND.siteUrl}/docs/reference)
- [Library catalog](${BRAND.siteUrl}/docs/libraries)
- [Keep a project up to date](${BRAND.siteUrl}/docs/maintain): update, add, doctor

## Official kits

${kits
  .filter((k) => k.kit)
  .map(({ entry, kit }) => `- [${entry.name}](${BRAND.siteUrl}/kits/${entry.name}): ${entry.description} Options: ${kit!.options.map((o) => o.id).join(", ") || "none"}. \`${buildInitCommand(entry.name, kit!, defaultSelections(kit!))}\``)
  .join("\n")}

## Stacks

${stacks.map((s) => `- [${s.stack.title}](${BRAND.siteUrl}/stacks/${s.stack.slug}): \`${buildInitCommand(s.kit.name, s.kit, s.selections)}\``).join("\n")}
`;
  return new Response(body, { headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
