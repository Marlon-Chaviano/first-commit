import { REGISTRY_RAW_BASE } from "@kits/schema";
import type { Metadata } from "next";

import { Code, CodeBlock, DocsHeader, Fields, H2, P } from "@/features/docs/docs-ui";

export const metadata: Metadata = {
  alternates: { canonical: "/docs/reference" },
  title: "kit.json reference",
  description: "Every field of a kit: base, dependencies, skills, MCP, options, libraries, files and tasks.",
};

const EXAMPLE = `{
  "$schema": "${REGISTRY_RAW_BASE}/kit.schema.json",
  "name": "my-saas",
  "version": "1.0.0",
  "title": "My SaaS stack",
  "description": "Next.js + Supabase with my go-to skills.",
  "category": "saas",
  "tags": ["nextjs", "supabase"],
  "author": "your-user",
  "base": { "command": "npx create-next-app@latest {{name}} --yes --use-{{pm}}" },
  "libraries": {
    "framework": ["react", "nextjs"],
    "components": "shadcn",
    "animation": ["motion"],
    "observability": ["sentry-nextjs"]
  },
  "dependencies": ["@supabase/supabase-js"],
  "skills": ["supabase/agent-skills@supabase"],
  "mcp": { "supabase": { "url": "https://mcp.supabase.com/mcp" } },
  "env": { "NEXT_PUBLIC_SUPABASE_URL": "" },
  "options": [
    {
      "id": "payments",
      "label": "Payments",
      "default": "none",
      "choices": [
        { "id": "none", "label": "No payments" },
        {
          "id": "stripe",
          "label": "Stripe",
          "dependencies": ["stripe"],
          "skills": ["stripe/ai@stripe-best-practices"],
          "setupTasks": ["Put STRIPE_SECRET_KEY in .env"],
          "instructions": "## Payments\\n\\nAlways verify webhook signatures."
        }
      ]
    }
  ],
  "instructions": "## How to work here\\n\\n- Every new table gets RLS."
}`;

export default function ReferenceDocs() {
  return (
    <>
      <DocsHeader title="kit.json reference">
        The full schema is at <Code>{`${REGISTRY_RAW_BASE}/kit.schema.json`}</Code>; link it with <Code>$schema</Code> to get
        autocomplete and validation in your editor.
      </DocsHeader>

      <H2>Example</H2>
      <CodeBlock code={EXAMPLE} />

      <H2>Identity</H2>
      <Fields
        rows={[
          ["name", "Lowercase and hyphens. It's the name used in the command."],
          ["version", "Semver (1.0.0). Bump it on every change and create the matching git tag."],
          ["extends", <>The kit this one starts from (<Code>landing-next</Code>, <Code>user/repo/kit</Code>, <Code>./path</Code>, with an optional <Code>@version</Code>).</>],
          ["title / description", "What shows in the catalog. The description says what someone gets by using it."],
          ["category", "mobile, web, landing, saas, api, extension, monorepo or other."],
          ["tags / author", "For search and attribution."],
        ]}
      />

      <H2>Creating the project</H2>
      <Fields
        rows={[
          ["base.command", <>Creates the project and must create the <Code>{"{{name}}"}</Code> folder. Variables: <Code>{"{{name}}"}</Code>, <Code>{"{{pm}}"}</Code>, <Code>{"{{pmx}}"}</Code>, <Code>{"{{opt.<id>}}"}</Code>.</>],
          ["base.install", "Installs dependencies if the scaffolder didn't (for example, with --no-install)."],
          ["addCommand", <>How to add packages, for example <Code>{"npx expo install {{packages}}"}</Code>.</>],
          ["packageManagers", "Supported package managers; the first one is the default."],
          ["finalize", "Commands run last, after every option's setup (a monorepo installs once all its apps exist). A failure stops the install."],
          ["verify.command", <>What <Code>test</Code> runs in each generated project. Defaults to <Code>{"{{pm}} run build"}</Code>.</>],
          ["verify.matrix", <>Combinations to test, each on top of the defaults: <Code>{'[{ "styling": ["nativewind"] }]'}</Code>. Without it, the defaults and one variant per option are tested.</>],
        ]}
      />

      <H2>What gets added</H2>
      <P>These fields work at the kit&apos;s root and inside each option choice, and catalog libraries use them too.</P>
      <Fields
        rows={[
          ["dependencies / devDependencies", "Packages added after the project is created."],
          ["skills", <><Code>owner/repo@skill</Code> references from skills.sh. They&apos;re installed for every chosen agent.</>],
          ["mcp", <>MCP servers: <Code>{"{ command, args, env }"}</Code> or <Code>{"{ url }"}</Code>. Written in each agent&apos;s format.</>],
          ["env", <>Variables added to <Code>.env.example</Code>.</>],
          ["files", "A folder of the kit copied over the project."],
          ["writeFiles", <>Small files, no downloads: <Code>{"{ path, content, mode }"}</Code>. <Code>mode</Code>: create, append, prepend, insert-before (with <Code>anchor</Code>) or json-merge.</>],
          ["postInstall", "Commands run inside the project at the end. If they fail, you get a warning and the install continues."],
          ["setupTasks", <>What can&apos;t be automated. Written as a first-steps checklist in <Code>AGENTS.md</Code>.</>],
          ["instructions", <>Markdown added to <Code>AGENTS.md</Code>; <Code>CLAUDE.md</Code> and <Code>GEMINI.md</Code> import it.</>],
        ]}
      />

      <H2>Options</H2>
      <Fields
        rows={[
          ["options[].id / label", <>The id is the CLI flag: <Code>--payments stripe</Code>.</>],
          ["options[].type", "select (one) or multi (several)."],
          ["options[].default", "The default choice id, or a list for multi."],
          ["choices[].requires", <>Can only be picked when another option has certain values: <Code>{'{ "styling": ["nativewind"] }'}</Code>.</>],
        ]}
      />

      <H2>Libraries</H2>
      <Fields
        rows={[
          ["libraries.framework", <>Fixed (<Code>{'["react", "nextjs"]'}</Code>) or taken from an option (<Code>{'{ "option": "framework" }'}</Code>). It decides which libraries are offered.</>],
          ["libraries.components", <>The default component library, or <Code>none</Code>.</>],
          ["libraries.addons / animation / observability", <>Default lists (<Code>[]</Code> to offer them without preselecting). Omit the key to not offer that category.</>],
        ]}
      />
    </>
  );
}
