import { cliCommand, LOCK_FILE } from "@kits/schema";
import type { Metadata } from "next";

import { Cmd, Code, DocsHeader, Fields, H2, P } from "@/features/docs/docs-ui";

export const metadata: Metadata = {
  title: "Keep your project up to date",
  description: "kits.lock, update, add and doctor: the project stays connected to its kit after it's created.",
};

export default function MaintainDocs() {
  return (
    <>
      <DocsHeader title="Keep your project up to date">
        A project created from a kit records in <Code>{LOCK_FILE}</Code> which kit it came from, what you chose and which files the
        kit wrote. Commit it: with it, the project gets the kit&apos;s improvements without losing your changes.
      </DocsHeader>

      <H2 id="update">Update to the new kit</H2>
      <Cmd>{cliCommand("update --dry-run")}</Cmd>
      <P>Shows what would change; without <Code>--dry-run</Code> it applies it after you confirm. An update:</P>
      <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-muted-foreground">
        <li>Adds the kit&apos;s new dependencies, skills, MCP servers and variables.</li>
        <li>Rewrites the kit&apos;s section in <Code>AGENTS.md</Code> (the rest of the file is yours and is left alone).</li>
        <li>Updates the kit&apos;s files you haven&apos;t modified. The ones you edited or deleted are listed and left alone.</li>
        <li>Never uninstalls anything or reruns setup commands: whatever the kit stops using is listed so you decide.</li>
      </ul>
      <P>
        To move to a specific version: <Code>{cliCommand("update 1.2.0")}</Code>. Once a day, the CLI lets you know when there&apos;s
        a new version of your project&apos;s kit.
      </P>

      <H2 id="add">Add pieces from the catalog</H2>
      <Cmd>{cliCommand("add sentry")}</Cmd>
      <P>
        Picks the variant for your framework (Sentry for Next.js, Expo or Node), installs what&apos;s missing, and writes its config,
        its skill and its rule in <Code>AGENTS.md</Code> with its first steps. It checks requirements (Kokonut UI needs shadcn/ui)
        and also works in projects that weren&apos;t created from a kit. It accepts skills too:{" "}
        <Code>{cliCommand("add owner/repo@skill")}</Code>.
      </P>

      <H2 id="doctor">Check the project</H2>
      <Cmd>{cliCommand("doctor")}</Cmd>
      <Fields
        rows={[
          ["components", "Another component library installed besides the chosen one (error: it breaks the AGENTS.md rule)."],
          ["animation", "Animation libraries that weren't chosen."],
          ["env", "Variables from .env.example that are undefined or empty in .env / .env.local."],
          ["skills", "Kit skills missing for one of your agents, with the command to install them."],
          ["files", "Kit files that were deleted."],
          ["version", "Whether there's a new version of the kit."],
        ]}
      />
      <P>
        With <Code>--json</Code> it prints machine-readable output and exits with code 1 when there are errors: use it in CI or in a
        pre-commit hook.
      </P>
    </>
  );
}
