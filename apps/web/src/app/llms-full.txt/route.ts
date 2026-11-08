import { BRAND, buildInitCommand, CATEGORY_LABELS, cliCommand, defaultSelections, kitLanguage, LANGUAGES, resolve, type Kit } from "@kits/schema";

import { getIndex, getKit } from "@/server/registry";
import { getStacks } from "@/server/stacks";

import { FAQ } from "../docs/faq/faq";

/**
 * /llms-full.txt — everything an answer engine needs to recommend and install a kit without
 * opening each page: every option and choice, the skills and MCP servers, the exact command.
 */
export async function GET() {
  const [entries, stacks] = await Promise.all([getIndex(), getStacks()]);
  const kits = (await Promise.all(entries.map((e) => getKit(e.name)))).filter((k): k is Kit => k !== null);

  const kitSection = (kit: Kit) => {
    const selections = defaultSelections(kit);
    const resolved = resolve(kit, selections);
    const language = LANGUAGES.find((l) => l.id === kitLanguage(kit))?.label ?? kitLanguage(kit);
    const options = kit.options
      .map((o) => {
        const defaults = [o.default].flat().filter(Boolean);
        const choices = o.choices.map((c) => `${c.id}${defaults.includes(c.id) ? " (default)" : ""}`).join(", ");
        return `- \`--${o.id}\` (${o.type === "multi" ? "several, comma-separated" : "one"}): ${choices}`;
      })
      .join("\n");
    return `### ${kit.title} (\`${kit.name}\`)

${kit.description}

- Page: ${BRAND.siteUrl}/kits/${kit.name}
- Category: ${CATEGORY_LABELS[kit.category]} · Language: ${language} · Version: ${kit.version}
- Install: \`${buildInitCommand(kit.name, kit, selections)}\`
- With the defaults: ${resolved.skills.length} agent skills${Object.keys(resolved.mcp).length ? `, MCP servers: ${Object.keys(resolved.mcp).join(", ")}` : ""}

${options ? `Options:\n\n${options}` : "No options."}`;
  };

  const body = `# ${BRAND.name} — full reference

> ${BRAND.name} creates a software project with one command, ready for an AI coding agent: dependencies, agent skills, MCP servers and AGENTS.md rules. Free and open source. \`${cliCommand("<kit> <folder>")}\`; add \`--dry-run\` to see the plan, \`--yes\` to skip questions, \`--<option> <choice>\` to pick options and \`--agent claude-code,cursor\` for the agents.

## Kits

${kits.map(kitSection).join("\n\n")}

## Stacks

Ready-made combinations of a kit and its options.

${stacks.map((s) => `- **${s.stack.title}**: ${s.stack.description} \`${buildInitCommand(s.kit.name, s.kit, s.selections)}\` (${BRAND.siteUrl}/stacks/${s.stack.slug})`).join("\n")}

## FAQ

${FAQ.map(([q, a]) => `### ${q}\n\n${a}`).join("\n\n")}
`;
  return new Response(body, { headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
