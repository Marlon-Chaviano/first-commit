import { BRAND, cliCommand } from "@kits/schema";
import type { Metadata } from "next";
import Link from "next/link";

import { OriginIcon } from "@/components/shared/origin-icon";
import { Cmd, Code, DocsHeader, H2, P } from "@/features/docs/docs-ui";
import { DOCS_SECTIONS } from "@/lib/site-nav";
import { BrandName } from "@/components/shared/brand-name";

export const metadata: Metadata = {
  title: "Documentation",
  description: `What ${BRAND.name} is, how a kit works and how to start a project ready for your agent in one command.`,
};

const STEPS = [
  ["Pick a kit", "Search the ranking, or describe your project and we'll recommend one."],
  ["Configure it", "Choose the stack (UI, database, payments, deployment…), the agents and the package manager."],
  ["Copy the command", "The CLI creates the project, installs everything and gives your agent the stack's rules."],
] as const;

export default function DocsOverview() {
  return (
    <>
      <DocsHeader title="Introduction">
        <BrandName /> creates projects ready to build with your agent: the base project, the dependencies, the skills, the
        MCP servers and the rules in <Code>AGENTS.md</Code>, in a single command.
      </DocsHeader>

      <H2 id="get-started">Get started</H2>
      <P>Nothing to install, in an empty folder. Pick a kit and answer its questions:</P>
      <Cmd>{cliCommand().trim()}</Cmd>
      <P>Or straight away with a kit and its options (copy them from each kit&apos;s page):</P>
      <Cmd>{cliCommand("saas-next-supabase my-app --payments stripe")}</Cmd>

      <H2 id="how-it-works">How it works</H2>
      <ol className="mt-3 grid gap-3 sm:grid-cols-3">
        {STEPS.map(([title, text], i) => (
          <li key={title} className="flex flex-col gap-2 rounded-lg border p-4">
            <span className="font-mono text-xs text-muted-foreground tabular-nums">0{i + 1}</span>
            <span className="font-medium">{title}</span>
            <span className="text-sm text-pretty text-muted-foreground">{text}</span>
          </li>
        ))}
      </ol>

      <H2 id="what-is-a-kit">What a kit is</H2>
      <P>
        A folder with a <Code>kit.json</Code> that describes how to create the project and what to add to it. When you install it, the CLI
        shows the plan and then:
      </P>
      <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-muted-foreground">
        <li>Runs the framework&apos;s official command (create-next-app, create-expo-app, rails new…).</li>
        <li>Installs the libraries you chose and writes their config files.</li>
        <li>
          Installs the skills for your agents: the <strong className="text-foreground"><BrandName /> pack</strong> (plan, debug,
          verify), the design pack when there&apos;s an interface, and the framework&apos;s official skills.
        </li>
        <li>Configures the MCP servers and writes the stack&apos;s rules in <Code>AGENTS.md</Code>.</li>
        <li>
          Saves <Code>kits.lock</Code> so you can later bring in improvements with <Code>update</Code> or add pieces with <Code>add</Code>.
        </li>
      </ul>

      <H2 id="origin">Where kits come from</H2>
      <dl className="mt-3 flex flex-col divide-y">
        {(
          [
            ["official", "Official", `Maintained in the ${BRAND.name} repository. Every version is tagged and its contents are pinned by hash.`],
            ["verified", "Verified", "Its current version passed the test: it was installed and built with all its combinations in GitHub Actions."],
            ["community", "Community", "Published by anyone from their repository. Review the plan before installing them."],
          ] as const
        ).map(([origin, title, text]) => (
          <div key={origin} className="flex gap-3 py-3">
            <OriginIcon origin={origin} className="mt-0.5 size-4" />
            <div className="flex flex-col gap-0.5">
              <dt className="font-medium">{title}</dt>
              <dd className="text-sm text-muted-foreground">{text}</dd>
            </div>
          </div>
        ))}
      </dl>

      <H2 id="next-steps">Next steps</H2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {DOCS_SECTIONS.flatMap((s) => s.pages)
          .filter((p) => p.href !== "/docs")
          .map((page) => (
            <Link key={page.href} href={page.href} className="rounded-lg border px-4 py-3 text-sm transition-colors hover:bg-muted/50">
              {page.label} <span className="text-muted-foreground">→</span>
            </Link>
          ))}
      </div>
    </>
  );
}
