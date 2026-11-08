import { BRAND, KITS_SKILL, KITS_SKILL_PUBLISHED, REPO_URL } from "@kits/schema";
import type { Metadata } from "next";

import { Cmd, Code, CodeBlock, DocsHeader, Fields, H2, P } from "@/features/docs/docs-ui";

export const metadata: Metadata = {
  alternates: { canonical: "/docs/agents" },
  title: "Use kits from your agent",
  description: "MCP server, skill and prompt so Claude Code, Cursor or Codex create and maintain projects with kits.",
};

const LOCAL = ["npx", "-y", BRAND.cli, "mcp"];

export default function AgentsDocs() {
  const [skillRepo, skillName] = KITS_SKILL.split("@");
  return (
    <>
      <DocsHeader title="Use kits from your agent">
        Your agent can pick the kit, show you the plan and create the project for you. Ask in your own words: &quot;create a landing
        page with animations and analytics&quot;.
      </DocsHeader>

      <H2 id="mcp">Local MCP server</H2>
      <P>
        It runs on your machine with <Code>{LOCAL.join(" ")}</Code> and it&apos;s the only one that creates projects. Before running
        anything, the agent shows you the plan (<Code>plan_init</Code>) and needs your approval.
      </P>
      <P>Claude Code:</P>
      <Cmd>{`claude mcp add ${BRAND.name} -- ${LOCAL.join(" ")}`}</Cmd>
      <P>
        Cursor (<Code>.cursor/mcp.json</Code>):
      </P>
      <CodeBlock code={JSON.stringify({ mcpServers: { [BRAND.name]: { command: LOCAL[0], args: LOCAL.slice(1) } } }, null, 2)} />
      <P>
        Codex (<Code>~/.codex/config.toml</Code>):
      </P>
      <CodeBlock code={`[mcp_servers.${BRAND.name}]\ncommand = "${LOCAL[0]}"\nargs = [${LOCAL.slice(1).map((a) => `"${a}"`).join(", ")}]`} />
      <P>
        Creating a project takes a few minutes. If your agent cuts off long-running tools, raise its timeout (in Claude Code, the{" "}
        <Code>MCP_TOOL_TIMEOUT</Code> variable, in milliseconds).
      </P>

      <H2 id="tools">Tools</H2>
      <Fields
        rows={[
          ["search_kits", "Searches kits by text, category or library (stripe, sentry, motion…)."],
          ["get_kit", "A kit's options with their values and requirements, skills and default command."],
          ["recommend_kit", "Kit and options for your project's description, with the reasons. Always a valid combination."],
          ["plan_init", "Everything init would do (commands, files, skills), without running anything."],
          ["init_kit", "Creates the project. Local server only, with explicit approval."],
          ["add_library", "Adds a catalog library or a skill to the project. Local server only."],
        ]}
      />

      <H2 id="remote">Remote MCP server</H2>
      <P>
        Nothing to install: <Code>{`${BRAND.siteUrl}/mcp`}</Code> (HTTP, no session). It searches, recommends and plans; it doesn&apos;t
        run commands, so it returns the command for your agent to run in your terminal.
      </P>
      <Cmd>{`claude mcp add --transport http ${BRAND.name} ${BRAND.siteUrl}/mcp`}</Cmd>

      <H2 id="skill">Skill</H2>
      <P>
        The <Code>{skillName}</Code> skill teaches the agent when to use kits, how to choose options and how to maintain the project with{" "}
        <Code>update</Code>, <Code>add</Code> and <Code>doctor</Code>.
        {KITS_SKILL_PUBLISHED
          ? " Every official kit installs it."
          : " It isn't on skills.sh yet; meanwhile, install it from a copy of the repository."}
      </P>
      <Cmd>{`npx skills@latest add ${skillRepo} --skill ${skillName}`}</Cmd>
      <P>
        The skill&apos;s source: <a className="underline underline-offset-4" href={`${REPO_URL}/tree/${BRAND.branch}/skills/${skillName}`}>skills/{skillName}</a>.
      </P>

      <H2 id="prompt">Without MCP: the prompt</H2>
      <P>
        On every kit&apos;s page, the <Code>Prompt</Code> tab next to the command gives you a prompt to paste into your agent with the
        options you chose: the agent runs the command with <Code>--dry-run</Code>, shows you the plan and applies it once you confirm.
      </P>
    </>
  );
}
