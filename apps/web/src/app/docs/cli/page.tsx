import { AGENTS, BRAND, cliCommand } from "@kits/schema";
import type { Metadata } from "next";

import { Cmd, Code, DocsHeader, Fields, H2, P } from "@/features/docs/docs-ui";

export const metadata: Metadata = {
  alternates: { canonical: "/docs/cli" },
  title: "CLI",
  description: `Every ${BRAND.cli} command: create projects, create and test kits, maintain projects and the MCP server.`,
};

const c = (args: string) => <Code>{cliCommand(args)}</Code>;

export default function CliDocs() {
  return (
    <>
      <DocsHeader title="CLI">
        <Code>{BRAND.cli}</Code> doesn&apos;t need installing: use it with <Code>npx</Code> (or <Code>pnpm dlx</Code>, <Code>bunx</Code>). If you
        install it globally with <Code>npm i -g {BRAND.cli}</Code>, the command is <Code>{BRAND.bin}</Code>.
      </DocsHeader>

      <H2 id="create">Create a project</H2>
      <Cmd>{cliCommand("<kit> [name] [options]")}</Cmd>
      <P>With no arguments it opens a kit picker. Before running anything it shows the full plan and asks for confirmation.</P>
      <Fields
        rows={[
          ["--<option> <value>", <>Picks one of the kit&apos;s options, for example {c("saas-next-supabase --payments stripe")}. Each kit&apos;s options are on its page or in {c("info <kit>")}.</>],
          ["--skill <owner/repo@skill>", "Adds a skill (repeatable)."],
          ["--no-skill <owner/repo@skill>", "Removes one of the kit's skills (repeatable). --no-skills installs none."],
          ["--agent <a,b>", `Agents to install skills and rules for: ${AGENTS.map((a) => a.id).join(", ")}.`],
          ["--pm <manager>", "Package manager (npm, pnpm, bun… depending on the kit)."],
          ["--brand <owner/name>", "Applies a brand profile (or a file: --brand ./brand.json)."],
          ["--dry-run", "Shows the plan without running anything."],
          ["--no-git", "Skips the initial commit."],
          ["-y, --yes", "No questions: uses the defaults. With unverified community kits it also needs --allow-commands."],
        ]}
      />

      <H2 id="kits">Kit references</H2>
      <Fields
        rows={[
          ["mobile-expo[@1.2.0]", "Official kit (optionally at a version)."],
          ["user/repo[/path][@v1]", "Community kit on GitHub, published or not (the version is a git tag)."],
          ["./path/to/kit", "Local kit, to try it while you write it."],
        ]}
      />

      <H2 id="discover">Discover</H2>
      <Fields
        rows={[
          [cliCommand("list"), "Lists the registry's kits."],
          [cliCommand("info <kit>"), "A kit's options, skills and default command."],
        ]}
      />

      <H2 id="maintain">Inside a project</H2>
      <P>They work in projects created from a kit (they read <Code>kits.lock</Code>).</P>
      <Fields
        rows={[
          [cliCommand("update [version]"), "Brings in the kit's improvements without overwriting files you changed."],
          [cliCommand("add <library|skill>"), "Adds a catalog library (sentry, posthog, kokonutui…) or an owner/repo@skill skill."],
          [cliCommand("doctor [--json]"), "Checks that the project still follows the kit's rules."],
          [cliCommand("brand <owner/name>"), "Applies a brand profile: the company's colors, fonts, rules and docs."],
          [cliCommand("brand detect [folder]"), "Creates a brand.json from a project's styles."],
        ]}
      />

      <H2 id="creators">For creators</H2>
      <Fields
        rows={[
          [cliCommand("create [folder]"), "Turns a project into a kit (detects the framework, libraries, skills and MCP). --blank <name> creates an empty one."],
          [cliCommand("test [kit]"), "Installs and builds the kit with all its combinations. In GitHub Actions, --upload earns it the Verified badge."],
          [cliCommand("login"), "Logs in from the browser: check that the code matches your terminal and authorize. In CI, pass a token with --token or KITS_TOKEN."],
          [cliCommand("logout | whoami"), "Logs out (and revokes the token on the server), or shows who you're logged in as."],
          [cliCommand("<command> --help"), "Options of create, test and login. --verbose shows every command's output instead of the progress bar."],
          [cliCommand("publish [folder]"), "Publishes the kit at the current commit (must be on GitHub). --org <org> publishes it to your organization's private registry."],
        ]}
      />

      <H2 id="agents">For agents</H2>
      <Fields rows={[[cliCommand("mcp"), "MCP server over stdio: search, recommend, plan and create projects (asks for approval before running)."]]} />

      <H2 id="telemetry">Telemetry</H2>
      <P>
        The CLI counts installs anonymously (kit, chosen options and agents) for the ranking. Turn it off with{" "}
        <Code>DO_NOT_TRACK=1</Code>.
      </P>
    </>
  );
}
