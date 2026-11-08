import { BRAND, cliCommand } from "@kits/schema";
import type { Metadata } from "next";
import Link from "next/link";

import { AgentSetup } from "@/features/agent-help/agent-setup";
import { Cmd, Code, CodeBlock, DocsHeader, H2, P } from "@/features/docs/docs-ui";
import { BrandName } from "@/components/shared/brand-name";

export const metadata: Metadata = {
  alternates: { canonical: "/docs/create-kit" },
  title: "Create a kit",
  description: "Turn your project into a kit with one command, make variants with extends and share it.",
};

const VERIFY_WORKFLOW = `# .github/workflows/kit.yml
name: Verify kit
on: { push: { branches: [main] } }
permissions: { contents: read, id-token: write }
jobs:
  verify:
    strategy: { matrix: { os: [ubuntu-latest, macos-latest] } }
    runs-on: \${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: ${BRAND.repo}/actions/verify@main
        with: { kit: ./kit }`;

const EXTENDS_EXAMPLE = `{
  "name": "landing-dark",
  "version": "0.1.0",
  "extends": "landing-next",
  "title": "Dark landing page",
  "libraries": { "addons": ["magicui"] },
  "instructions": "## Style\\n\\nEverything in dark mode."
}`;

export default function CreateKitDocs() {
  return (
    <>
      <DocsHeader title="Create a kit">
        A kit is a folder with a <Code>kit.json</Code> and, optionally, files that get copied into the project. The fastest way
        is to generate it from a project you already like.
      </DocsHeader>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <AgentSetup tasks={["kit"]} />
        <span className="text-sm text-muted-foreground">Or let your agent create it for you.</span>
      </div>

      <H2 id="from-your-project">1. From your project</H2>
      <P>Inside a Next.js, Expo, Hono, WXT or Vite project:</P>
      <Cmd>{cliCommand("create")}</Cmd>
      <P>It detects the following and lets you review it before writing anything:</P>
      <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-muted-foreground">
        <li>The framework, and with it the official command that creates the base project.</li>
        <li>
          The libraries from the <Link href="/docs/libraries" className="text-foreground underline underline-offset-4">catalog</Link>{" "}
          you use (shadcn, Kokonut UI, Motion, Sentry…), which become options with their rule in <Code>AGENTS.md</Code>.
        </li>
        <li>Your own dependencies, minus the ones the base template already brings.</li>
        <li>
          Your skills (from <Code>skills-lock.json</Code>), MCP servers (<Code>.mcp.json</Code>) and variables (
          <Code>.env.example</Code>; it never reads <Code>.env</Code>).
        </li>
        <li>Your <Code>AGENTS.md</Code> instructions, minus what <BrandName /> or the scaffolder generate.</li>
        <li>Your own files you choose to copy (config, utilities). None by default.</li>
      </ul>
      <P>
        The kit ends up in <Code>./kit</Code>. Without questions: <Code>{cliCommand("create -y --name my-kit --include src/lib")}</Code>.
        If the framework isn&apos;t recognized, pass the base command with <Code>--base &quot;…&quot;</Code>.
      </P>

      <H2 id="by-hand">2. By hand</H2>
      <Cmd>{cliCommand("create --blank my-kit")}</Cmd>
      <P>
        Creates a minimal <Code>kit.json</Code> with the schema linked, so your editor autocompletes it. Every field is in the{" "}
        <Link href="/docs/reference" className="text-foreground underline underline-offset-4">reference</Link>.
      </P>

      <H2 id="extends">3. Variants with extends</H2>
      <P>
        A kit can start from another one and declare only what changes. Lists (dependencies, skills, tasks) are added up,
        objects (<Code>env</Code>, <Code>mcp</Code>, <Code>libraries</Code>) are merged, instructions are appended, and an
        option with the same <Code>id</Code> is merged field by field with the parent&apos;s (so you can change just its default).
      </P>
      <CodeBlock code={EXTENDS_EXAMPLE} />
      <P>
        The parent can be an official kit, a repo (<Code>user/repo/kit</Code>) or a local path, with an optional version (
        <Code>landing-next@1.0.0</Code>). Up to 3 levels are allowed.
      </P>

      <H2 id="try-it">4. Try it</H2>
      <Cmd>{cliCommand("./kit my-project --dry-run")}</Cmd>
      <P>
        Shows every command and file without running anything. Drop <Code>--dry-run</Code> to create the project for real, and
        build it before sharing it.
      </P>

      <H2 id="share">5. Publish and version it</H2>
      <P>
        Push the kit to a public GitHub repo and publish it from the terminal (with a token from{" "}
        <Link href="/account" className="text-foreground underline underline-offset-4">your account</Link>) or from{" "}
        <Link href="/publish" className="text-foreground underline underline-offset-4">the website</Link>:
      </P>
      <Cmd>{cliCommand("login")}</Cmd>
      <Cmd>{cliCommand("publish ./kit")}</Cmd>
      <P>
        It appears in the catalog as <Code>your-user/kit-name</Code>, pinned to the published commit and with its integrity
        hash. Without publishing, it can also be installed straight from GitHub:
      </P>
      <Cmd>{cliCommand("your-user/your-repo/kit")}</Cmd>
      <P>
        Every change bumps <Code>version</Code> (semver) in <Code>kit.json</Code> and creates a git tag with that number. That
        way a specific version can be installed: <Code>{cliCommand("your-user/your-repo/kit@v1.2.0")}</Code>. To appear in
        the official catalog, open a PR that adds your kit to <Code>registry/kits/</Code>.
      </P>

      <H2 id="verify">6. Verify it</H2>
      <P>
        <Code>{cliCommand("test ./kit")}</Code> installs the kit with several combinations of options in temporary folders,
        runs its check (<Code>verify.command</Code>, <Code>build</Code> by default) and writes a report. For the{" "}
        <strong className="text-foreground">Verified</strong> badge, run it in GitHub Actions: the report is signed with the
        repository&apos;s OIDC token, so nobody can fake it.
      </P>
      <CodeBlock code={VERIFY_WORKFLOW} />
      <P>
        To choose which combinations to test, define <Code>verify.matrix</Code> in <Code>kit.json</Code> (see the{" "}
        <Link href="/docs/reference" className="text-foreground underline underline-offset-4">reference</Link>). Unverified
        community kits show a warning before running and, with <Code>-y</Code>, require <Code>--allow-commands</Code>.
      </P>

      <H2 id="best-practices">Best practices</H2>
      <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-muted-foreground">
        <li>Write instructions as concrete rules (&quot;add dependencies with npx expo install&quot;), not as descriptions.</li>
        <li>Use catalog libraries instead of loose dependencies: they bring their skill, their config and their rule.</li>
        <li>What can&apos;t be automated (creating an account, pasting a key) goes in <Code>setupTasks</Code>, not in the instructions.</li>
        <li>Prefer official skills from each tool&apos;s own organization.</li>
        <li>Don&apos;t copy your whole app: a kit is a starting point, not a clone.</li>
      </ul>

      <H2 id="security">Security</H2>
      <P>
        A kit runs commands on the machine of whoever installs it. The CLI always shows the full plan and, unless you pass{" "}
        <Code>-y</Code>, asks for confirmation. Review third-party kits as you would review a script.
      </P>
    </>
  );
}
