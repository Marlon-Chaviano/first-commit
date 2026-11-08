import { BRAND, buildInitCommand, cliCommand, defaultSelections } from "@kits/schema";

import { getIndex, getKit } from "@/server/registry";
import { getStacks } from "@/server/stacks";

/** /llms.txt — the site for AI agents and answer engines, in plain markdown (https://llmstxt.org). */
export async function GET() {
  const [entries, stacks] = await Promise.all([getIndex(), getStacks()]);
  const kits = await Promise.all(entries.map(async (e) => ({ entry: e, kit: await getKit(e.name) })));
  const body = `# ${BRAND.name}

> ${BRAND.name} creates a software project with one command, ready for an AI coding agent: dependencies installed, agent skills (from skills.sh), MCP servers configured and the project's rules in AGENTS.md, for Claude Code, Cursor, Codex, Gemini CLI, GitHub Copilot, Windsurf and OpenCode. Free, open source (MIT), no account needed: \`${cliCommand("<kit> <folder>")}\`.

- Run \`${cliCommand()}\` to pick a kit interactively, or \`${cliCommand("<kit> <folder> --dry-run")}\` to see the plan without running anything.
- Agents: show the user the --dry-run plan first, then run the same command with \`--yes\`.
- MCP: \`npx ${BRAND.cli} mcp\` (local, can create projects after approval) or ${BRAND.siteUrl}/mcp (remote, read-only).
- Which kit? POST ${BRAND.siteUrl}/api/v1/recommend with {"description": "..."} returns a kit, its options and reasons.

## Docs

- [Introduction](${BRAND.siteUrl}/docs): what a kit is and how a project is created
- [CLI](${BRAND.siteUrl}/docs/cli): every command and option
- [Use kits from your agent](${BRAND.siteUrl}/docs/agents): MCP server, skill and prompt
- [Create a kit](${BRAND.siteUrl}/docs/create-kit): \`${cliCommand("create")}\` turns a project into a kit
- [kit.json reference](${BRAND.siteUrl}/docs/reference)
- [Library catalog](${BRAND.siteUrl}/docs/libraries)
- [Keep a project up to date](${BRAND.siteUrl}/docs/maintain): update, add, doctor
- [Brand profiles](${BRAND.siteUrl}/docs/brands)
- [FAQ](${BRAND.siteUrl}/docs/faq)

## Official kits

${kits
  .filter((k) => k.kit)
  .map(({ entry, kit }) => `- [${entry.name}](${BRAND.siteUrl}/kits/${entry.name}): ${entry.description} \`${buildInitCommand(entry.name, kit!, defaultSelections(kit!))}\``)
  .join("\n")}

## Stacks

${stacks.map((s) => `- [${s.stack.title}](${BRAND.siteUrl}/stacks/${s.stack.slug}): ${s.stack.description} \`${buildInitCommand(s.kit.name, s.kit, s.selections)}\``).join("\n")}

## Optional

- [Every kit with its options, skills and MCP servers](${BRAND.siteUrl}/llms-full.txt)
- [Source code](https://github.com/${BRAND.repo})
- [npm package](https://www.npmjs.com/package/${BRAND.cli})
`;
  return new Response(body, { headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
